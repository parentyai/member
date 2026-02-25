'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'rich_menu_rate_buckets';

function pad(num) {
  return String(num).padStart(2, '0');
}

function resolveBucketId(now) {
  const date = now instanceof Date ? now : new Date();
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  return `${year}${month}${day}${hour}${minute}`;
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

async function incrementAndCheckRateBucket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const maxCount = normalizeInteger(payload.maxCount, 1, 1, 1000000);
  if (maxCount === null) throw new Error('invalid maxCount');
  const bucketId = normalizeText(payload.bucketId, '') || resolveBucketId(payload.now);
  const actor = normalizeText(payload.actor, 'unknown') || 'unknown';
  const traceId = normalizeText(payload.traceId, null);

  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(bucketId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const currentData = snap.exists ? (snap.data() || {}) : {};
    const currentCount = normalizeInteger(currentData.count, 0, 0, 1000000000) || 0;
    if (currentCount >= maxCount) {
      return {
        ok: true,
        allowed: false,
        bucketId,
        count: currentCount,
        maxCount
      };
    }

    const nextCount = currentCount + 1;
    tx.set(docRef, {
      bucketId,
      count: nextCount,
      maxCount,
      lastActor: actor,
      lastTraceId: traceId,
      updatedAt: serverTimestamp(),
      createdAt: snap.exists ? currentData.createdAt || serverTimestamp() : serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      allowed: true,
      bucketId,
      count: nextCount,
      maxCount
    };
  });
}

module.exports = {
  COLLECTION,
  resolveBucketId,
  incrementAndCheckRateBucket
};
