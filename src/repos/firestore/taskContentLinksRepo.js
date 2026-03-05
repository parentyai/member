'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'task_content_links';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const ALLOWED_STATUS = new Set(['active', 'warn']);
const ALLOWED_CONFIDENCE = new Set(['strict', 'manual']);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || 'active');
  if (!normalized) return fallback || 'active';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATUS.has(lowered)) return fallback || 'active';
  return lowered;
}

function normalizeConfidence(value, fallback) {
  const normalized = normalizeText(value, fallback || 'strict');
  if (!normalized) return fallback || 'strict';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_CONFIDENCE.has(lowered)) return fallback || 'strict';
  return lowered;
}

function normalizeTaskContentLink(ruleId, data) {
  const id = normalizeText(ruleId || (data && data.ruleId), '');
  if (!id) return null;
  const payload = data && typeof data === 'object' ? data : {};
  const sourceTaskKey = normalizeText(payload.sourceTaskKey, null);
  return {
    id,
    ruleId: id,
    sourceTaskKey,
    status: normalizeStatus(payload.status, sourceTaskKey ? 'active' : 'warn'),
    confidence: normalizeConfidence(payload.confidence, 'strict'),
    note: normalizeText(payload.note, null),
    migrationTraceId: normalizeText(payload.migrationTraceId, null),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedBy: normalizeText(payload.updatedBy, null)
  };
}

async function getTaskContentLink(ruleId) {
  const id = normalizeText(ruleId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeTaskContentLink(id, snap.data());
}

async function upsertTaskContentLink(ruleId, patch, actor) {
  const id = normalizeText(ruleId, '');
  if (!id) throw new Error('ruleId required');
  const existing = await getTaskContentLink(id);
  const normalized = normalizeTaskContentLink(id, Object.assign({}, existing || {}, patch || {}, { ruleId: id }));
  if (!normalized) throw new Error('invalid task content link');
  const updatedBy = normalizeText(actor, normalized.updatedBy || null);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: normalized.createdBy || updatedBy,
    updatedBy
  }), { merge: true });
  return getTaskContentLink(id);
}

async function listTaskContentLinks(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit);
  const status = normalizeText(payload.status, '').toLowerCase();
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (status && ALLOWED_STATUS.has(status)) {
    query = query.where('status', '==', status);
  }
  const snap = await query.orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => normalizeTaskContentLink(doc.id, doc.data()))
    .filter(Boolean);
}

module.exports = {
  COLLECTION,
  ALLOWED_STATUS,
  ALLOWED_CONFIDENCE,
  normalizeTaskContentLink,
  getTaskContentLink,
  upsertTaskContentLink,
  listTaskContentLinks
};
