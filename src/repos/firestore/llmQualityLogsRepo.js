'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_quality_logs';

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

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

async function appendLlmQualityLog(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const data = {
    userId: normalizeString(payload.userId, ''),
    intent: normalizeString(payload.intent, 'faq_search'),
    decision: normalizeString(payload.decision, 'blocked'),
    blockedReason: normalizeString(payload.blockedReason, null),
    top1Score: normalizeNumber(payload.top1Score, null),
    top2Score: normalizeNumber(payload.top2Score, null),
    citationCount: Math.max(0, Math.floor(normalizeNumber(payload.citationCount, 0))),
    retryCount: Math.max(0, Math.floor(normalizeNumber(payload.retryCount, 0))),
    model: normalizeString(payload.model, null),
    createdAt: payload.createdAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id, data };
}

async function listLlmQualityLogsByCreatedAtRange(params) {
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
  appendLlmQualityLog,
  listLlmQualityLogsByCreatedAtRange
};
