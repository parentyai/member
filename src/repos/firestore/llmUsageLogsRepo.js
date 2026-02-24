'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_usage_logs';

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function normalizeString(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function appendLlmUsageLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const data = {
    userId: normalizeString(payload.userId, ''),
    intent: normalizeString(payload.intent, 'faq_search'),
    plan: normalizeString(payload.plan, 'free'),
    subscriptionStatus: normalizeString(payload.subscriptionStatus, 'unknown'),
    tokensIn: normalizeNumber(payload.tokensIn, 0),
    tokensOut: normalizeNumber(payload.tokensOut, 0),
    tokenUsed: normalizeNumber(payload.tokenUsed, normalizeNumber(payload.tokensIn, 0) + normalizeNumber(payload.tokensOut, 0)),
    costEstimate: Number.isFinite(Number(payload.costEstimate)) ? Number(payload.costEstimate) : null,
    decision: normalizeString(payload.decision, 'blocked'),
    blockedReason: payload.blockedReason === null ? null : normalizeString(payload.blockedReason, null),
    model: typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : null,
    createdAt: payload.createdAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id, data };
}

async function listLlmUsageLogsByCreatedAtRange(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? Math.min(payload.limit, 5000) : 1000;
  const fromAt = toDate(payload.fromAt);
  const toAt = toDate(payload.toAt);
  const db = getDb();

  let query = db.collection(COLLECTION);
  if (fromAt) query = query.where('createdAt', '>=', fromAt);
  if (toAt) query = query.where('createdAt', '<=', toAt);
  const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  COLLECTION,
  appendLlmUsageLog,
  listLlmUsageLogsByCreatedAtRange
};
