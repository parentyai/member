'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { mapStripeSubscriptionStatus } = require('../../usecases/billing/mapStripeSubscriptionStatus');

const COLLECTION = 'user_subscriptions';
const IN_QUERY_CHUNK_SIZE = 10;

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePlan(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'free';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'pro') return 'pro';
  return 'free';
}

function toIsoOrNull(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1000000000000) return new Date(value).toISOString();
    return new Date(value * 1000).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function toUnixSecondsOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Math.floor(value.getTime() / 1000);
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return Math.floor(parsed.getTime() / 1000);
  }
  return null;
}

function chunkList(list, size) {
  const out = [];
  const chunkSize = Math.max(1, Number(size) || IN_QUERY_CHUNK_SIZE);
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

function normalizeSubscription(lineUserId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: normalizeLineUserId(lineUserId),
    lineUserId: normalizeLineUserId(lineUserId),
    plan: normalizePlan(payload.plan),
    status: mapStripeSubscriptionStatus(payload.status),
    currentPeriodEnd: toIsoOrNull(payload.currentPeriodEnd),
    currentPeriodEndUnix: toUnixSecondsOrNull(payload.currentPeriodEnd),
    stripeCustomerId: typeof payload.stripeCustomerId === 'string' && payload.stripeCustomerId.trim().length > 0
      ? payload.stripeCustomerId.trim()
      : null,
    stripeSubscriptionId: typeof payload.stripeSubscriptionId === 'string' && payload.stripeSubscriptionId.trim().length > 0
      ? payload.stripeSubscriptionId.trim()
      : null,
    lastEventId: typeof payload.lastEventId === 'string' && payload.lastEventId.trim().length > 0
      ? payload.lastEventId.trim()
      : null,
    lastEventCreatedAt: toIsoOrNull(payload.lastEventCreatedAt),
    updatedAt: payload.updatedAt || null
  };
}

async function getUserSubscription(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeSubscription(id, snap.data());
}

async function upsertUserSubscription(lineUserId, patch) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const data = patch && typeof patch === 'object' ? patch : {};
  const payload = {
    lineUserId: id,
    plan: normalizePlan(data.plan),
    status: mapStripeSubscriptionStatus(data.status),
    currentPeriodEnd: toIsoOrNull(data.currentPeriodEnd),
    currentPeriodEndUnix: toUnixSecondsOrNull(data.currentPeriodEnd),
    stripeCustomerId: typeof data.stripeCustomerId === 'string' && data.stripeCustomerId.trim().length > 0
      ? data.stripeCustomerId.trim()
      : null,
    stripeSubscriptionId: typeof data.stripeSubscriptionId === 'string' && data.stripeSubscriptionId.trim().length > 0
      ? data.stripeSubscriptionId.trim()
      : null,
    lastEventId: typeof data.lastEventId === 'string' && data.lastEventId.trim().length > 0
      ? data.lastEventId.trim()
      : null,
    lastEventCreatedAt: toIsoOrNull(data.lastEventCreatedAt),
    updatedAt: data.updatedAt || serverTimestamp()
  };
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(payload, { merge: true });
  return normalizeSubscription(id, payload);
}

async function listUserSubscriptionsByLineUserIds(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserIds = Array.from(new Set(
    (Array.isArray(payload.lineUserIds) ? payload.lineUserIds : [])
      .map((value) => normalizeLineUserId(value))
      .filter(Boolean)
  ));
  if (!lineUserIds.length) return [];
  const db = getDb();
  const chunks = chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE);
  const rows = [];
  for (const chunk of chunks) {
    // Firestore does not support batch doc-get API in this codebase, so we issue parallel doc reads.
    const docs = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db.collection(COLLECTION).doc(lineUserId).get();
      if (!snap.exists) return null;
      return normalizeSubscription(lineUserId, snap.data());
    }));
    docs.filter(Boolean).forEach((item) => rows.push(item));
  }
  return rows;
}

module.exports = {
  COLLECTION,
  getUserSubscription,
  upsertUserSubscription,
  listUserSubscriptionsByLineUserIds
};
