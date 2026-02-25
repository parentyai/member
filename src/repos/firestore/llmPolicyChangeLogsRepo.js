'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_policy_change_logs';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeChangeLog(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: docId,
    actor: normalizeText(payload.actor, 'unknown'),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    planHash: normalizeText(payload.planHash, null),
    policy: payload.policy && typeof payload.policy === 'object' ? payload.policy : {},
    canonicalization: payload.canonicalization && typeof payload.canonicalization === 'object'
      ? payload.canonicalization
      : {},
    createdAt: normalizeDate(payload.createdAt),
    updatedAt: payload.updatedAt || null
  };
}

function buildLogId() {
  return `llm_policy_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

async function appendLlmPolicyChangeLog(payload) {
  const entry = payload && typeof payload === 'object' ? payload : {};
  const id = buildLogId();
  const db = getDb();
  const normalized = normalizeChangeLog(id, Object.assign({}, entry, {
    createdAt: entry.createdAt || new Date().toISOString()
  }));
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp()
  }), { merge: true });
  return normalized;
}

function resolveLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 20;
  return Math.min(Math.floor(parsed), 100);
}

async function listLlmPolicyChangeLogs(limit) {
  const cap = resolveLimit(limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((doc) => normalizeChangeLog(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  normalizeChangeLog,
  appendLlmPolicyChangeLog,
  listLlmPolicyChangeLogs
};
