'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'notification_deliveries';
const DEFAULT_BACKFILL_LIMIT = 200;
const MAX_BACKFILL_LIMIT = 1000;
const BACKFILL_SAMPLE_LIMIT = 20;

function resolveTimestamp(at) {
  // Allow explicit null when callers want to indicate "not set yet".
  if (at === null) return null;
  return at || serverTimestamp();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function resolveDeliveredAt(record) {
  if (!record || typeof record !== 'object') return null;
  return toDate(record.deliveredAt) || toDate(record.sentAt) || null;
}

function toIso(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function normalizeBackfillLimit(limit) {
  if (limit === undefined || limit === null || limit === '') return DEFAULT_BACKFILL_LIMIT;
  const num = typeof limit === 'number' ? limit : Number(limit);
  if (!Number.isInteger(num) || num < 1 || num > MAX_BACKFILL_LIMIT) {
    throw new Error(`limit must be integer 1-${MAX_BACKFILL_LIMIT}`);
  }
  return num;
}

function isIndexError(err) {
  if (!err) return false;
  if (err.code === 9 || err.code === '9') return true; // Firestore FAILED_PRECONDITION
  if (typeof err.message !== 'string') return false;
  const lower = err.message.toLowerCase();
  return lower.includes('failed precondition') || lower.includes('index');
}

function buildDeliveredBaseQuery(db, lineUserId, notificationCategory) {
  let query = db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .where('delivered', '==', true);
  if (notificationCategory) {
    query = query.where('notificationCategory', '==', notificationCategory);
  }
  return query;
}

async function queryCount(query) {
  if (query && typeof query.count === 'function') {
    try {
      const aggregate = await query.count().get();
      if (aggregate && typeof aggregate.data === 'function') {
        const value = aggregate.data();
        if (value && Number.isFinite(value.count)) return value.count;
      }
    } catch (_err) {
      // Fall back to docs.length when aggregate query is unavailable.
    }
  }
  const snap = await query.get();
  return Array.isArray(snap.docs) ? snap.docs.length : 0;
}

async function countDeliveredSinceFallback({ db, lineUserId, sinceDate, notificationCategory }) {
  const snap = await buildDeliveredBaseQuery(db, lineUserId, notificationCategory).get();
  let count = 0;
  for (const doc of snap.docs) {
    const record = doc.data() || {};
    const at = resolveDeliveredAt(record);
    if (at && at.getTime() >= sinceDate.getTime()) count += 1;
  }
  return count;
}

async function countDeliveredSinceOptimized({ db, lineUserId, sinceDate, notificationCategory }) {
  const sinceIso = toIso(sinceDate);
  if (!sinceIso) throw new Error('sinceAt required');

  const base = buildDeliveredBaseQuery(db, lineUserId, notificationCategory);
  const deliveredAtQuery = base.where('deliveredAt', '>=', sinceIso);
  const deliveredAtCount = await queryCount(deliveredAtQuery);

  // Legacy compatibility: old rows may not have deliveredAt but still have sentAt.
  const legacySnap = await base.where('sentAt', '>=', sinceIso).get();
  let legacyCount = 0;
  for (const doc of legacySnap.docs) {
    const record = doc.data() || {};
    if (toDate(record.deliveredAt)) continue;
    const at = resolveDeliveredAt(record);
    if (!at || at.getTime() < sinceDate.getTime()) continue;
    if (notificationCategory) {
      const recCategory = typeof record.notificationCategory === 'string'
        ? record.notificationCategory.trim().toUpperCase()
        : '';
      if (recCategory !== notificationCategory) continue;
    }
    legacyCount += 1;
  }
  return deliveredAtCount + legacyCount;
}

async function createDelivery(data) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const payload = Object.assign({}, data || {}, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: false });
  return { id: docRef.id };
}

function reserveDeliveryId() {
  const db = getDb();
  return db.collection(COLLECTION).doc().id;
}

async function createDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const payload = Object.assign({}, data || {}, { sentAt: resolveTimestamp(data && data.sentAt) });
  await docRef.set(payload, { merge: true });
  return { id: docRef.id };
}

async function sealDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const payload = data && typeof data === 'object' ? data : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const snap = await docRef.get();
  if (!snap.exists) return { ok: false, reason: 'not_found', id: deliveryId };
  const record = snap.data() || {};
  if (record.delivered === true) return { ok: false, reason: 'already_delivered', id: deliveryId };
  if (record.sealed === true) return { ok: true, id: deliveryId, alreadySealed: true };
  await docRef.set({
    sealed: true,
    sealedAt: resolveTimestamp(payload.sealedAt),
    sealedBy: payload.sealedBy || null,
    sealedReason: payload.sealedReason || null,
    state: 'sealed'
  }, { merge: true });
  return { ok: true, id: deliveryId, sealed: true };
}

async function reserveDeliveryWithId(deliveryId, data) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const reservedAt = resolveTimestamp(data && data.reservedAt);
  // Reserve (create) the delivery doc before sending to prevent duplicates
  // across process crashes. If it already exists, return the existing doc.
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) {
      return { id: deliveryId, existing: Object.assign({ id: deliveryId }, snap.data()) };
    }
    tx.set(docRef, Object.assign({}, data || {}, {
      delivered: false,
      state: 'reserved',
      reservedAt,
      sentAt: null
    }), { merge: false });
    return { id: deliveryId, reserved: true };
  });
}

async function getDelivery(deliveryId) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function markRead(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ readAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function markClick(deliveryId, at) {
  if (!deliveryId) throw new Error('deliveryId required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(deliveryId);
  await docRef.set({ clickAt: resolveTimestamp(at) }, { merge: true });
  return { id: deliveryId };
}

async function listDeliveriesByUser(lineUserId, limit) {
  if (!lineUserId) throw new Error('lineUserId required');
  const db = getDb();
  let query = db.collection(COLLECTION).where('lineUserId', '==', lineUserId).orderBy('sentAt', 'desc');
  const max = typeof limit === 'number' ? limit : 50;
  if (max) query = query.limit(max);
  const snap = await query.get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function listDeliveriesByNotificationId(notificationId) {
  if (!notificationId) throw new Error('notificationId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('notificationId', '==', notificationId).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

async function countDeliveredByUserSince(lineUserId, sinceAt) {
  if (!lineUserId) throw new Error('lineUserId required');
  const sinceDate = toDate(sinceAt);
  if (!sinceDate) throw new Error('sinceAt required');
  const db = getDb();
  try {
    return await countDeliveredSinceOptimized({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: null
    });
  } catch (err) {
    if (!isIndexError(err)) throw err;
    return countDeliveredSinceFallback({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: null
    });
  }
}

async function countDeliveredByUserCategorySince(lineUserId, notificationCategory, sinceAt) {
  if (!lineUserId) throw new Error('lineUserId required');
  const category = typeof notificationCategory === 'string' ? notificationCategory.trim().toUpperCase() : '';
  if (!category) throw new Error('notificationCategory required');
  const sinceDate = toDate(sinceAt);
  if (!sinceDate) throw new Error('sinceAt required');
  const db = getDb();
  try {
    return await countDeliveredSinceOptimized({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: category
    });
  } catch (err) {
    if (!isIndexError(err)) throw err;
    return countDeliveredSinceFallback({
      db,
      lineUserId,
      sinceDate,
      notificationCategory: category
    });
  }
}

async function getDeliveredAtBackfillSummary(limit) {
  const max = normalizeBackfillLimit(limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('delivered', '==', true).get();
  const docs = Array.isArray(snap.docs) ? snap.docs.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];

  let deliveredCount = 0;
  let missingDeliveredAtCount = 0;
  let fixableCount = 0;
  let unfixableCount = 0;
  const candidates = [];
  const sampleFixable = [];
  const sampleUnfixable = [];

  for (const doc of docs) {
    const record = doc.data() || {};
    deliveredCount += 1;
    if (toDate(record.deliveredAt)) continue;
    missingDeliveredAtCount += 1;
    const sentAtIso = toIso(record.sentAt);
    if (sentAtIso) {
      fixableCount += 1;
      const candidate = { deliveryId: doc.id, sentAtIso };
      if (candidates.length < max) candidates.push(candidate);
      if (sampleFixable.length < BACKFILL_SAMPLE_LIMIT) sampleFixable.push(candidate);
      continue;
    }
    unfixableCount += 1;
    if (sampleUnfixable.length < BACKFILL_SAMPLE_LIMIT) {
      sampleUnfixable.push({
        deliveryId: doc.id,
        state: typeof record.state === 'string' ? record.state : null
      });
    }
  }

  return {
    limit: max,
    deliveredCount,
    missingDeliveredAtCount,
    fixableCount,
    unfixableCount,
    candidates,
    sampleFixable,
    sampleUnfixable
  };
}

async function applyDeliveredAtBackfill(candidates, options) {
  const list = Array.isArray(candidates) ? candidates : [];
  const actor = options && typeof options.actor === 'string' && options.actor.trim().length > 0
    ? options.actor.trim()
    : null;
  const atIso = toIso(options && options.backfilledAt) || new Date().toISOString();
  const db = getDb();
  const updatedIds = [];
  const skippedIds = [];

  for (const entry of list) {
    const deliveryId = entry && typeof entry.deliveryId === 'string' ? entry.deliveryId.trim() : '';
    const sentAtIso = toIso(entry && entry.sentAtIso);
    if (!deliveryId || !sentAtIso) {
      if (deliveryId) skippedIds.push(deliveryId);
      continue;
    }
    await db.collection(COLLECTION).doc(deliveryId).set({
      deliveredAt: sentAtIso,
      deliveredAtBackfilledAt: atIso,
      deliveredAtBackfilledBy: actor
    }, { merge: true });
    updatedIds.push(deliveryId);
  }

  return {
    ok: true,
    updatedCount: updatedIds.length,
    updatedIds,
    skippedCount: skippedIds.length,
    skippedIds,
    backfilledAt: atIso
  };
}

module.exports = {
  createDelivery,
  reserveDeliveryId,
  createDeliveryWithId,
  sealDeliveryWithId,
  reserveDeliveryWithId,
  getDelivery,
  markRead,
  markClick,
  listDeliveriesByUser,
  listDeliveriesByNotificationId,
  countDeliveredByUserSince,
  countDeliveredByUserCategorySince,
  getDeliveredAtBackfillSummary,
  applyDeliveredAtBackfill
};
