'use strict';

const crypto = require('crypto');

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_branch_queue';
const ALLOWED_STATUS = Object.freeze(['pending', 'sent', 'failed', 'skipped']);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || 'pending');
  if (!normalized) return 'pending';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATUS.includes(lowered)) return null;
  return lowered;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeEffect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function normalizeQueueItem(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    id: normalizeText(docId || payload.id, ''),
    lineUserId: normalizeText(payload.lineUserId, ''),
    deliveryId: normalizeText(payload.deliveryId, ''),
    todoKey: normalizeText(payload.todoKey, null),
    action: normalizeText(payload.action, ''),
    ruleId: normalizeText(payload.ruleId, ''),
    plan: normalizeText(payload.plan, 'free') || 'free',
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    actor: normalizeText(payload.actor, null),
    status: normalizeStatus(payload.status, 'pending') || 'pending',
    attempts: normalizeInt(payload.attempts, 0, 0, 100) || 0,
    branchDispatchStatus: normalizeText(payload.branchDispatchStatus, null),
    lastError: normalizeText(payload.lastError, null),
    nextAttemptAt: toIso(payload.nextAttemptAt),
    dispatchedAt: toIso(payload.dispatchedAt),
    effect: normalizeEffect(payload.effect),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null
  };
}

function createQueueId() {
  return `jbq_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function enqueueJourneyBranch(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const lineUserId = normalizeText(input.lineUserId, '');
  const deliveryId = normalizeText(input.deliveryId, '');
  const ruleId = normalizeText(input.ruleId, '');
  const action = normalizeText(input.action, '');
  if (!lineUserId) throw new Error('lineUserId required');
  if (!deliveryId) throw new Error('deliveryId required');
  if (!ruleId) throw new Error('ruleId required');
  if (!action) throw new Error('action required');

  const id = normalizeText(input.id, '') || createQueueId();
  const item = normalizeQueueItem(id, {
    id,
    lineUserId,
    deliveryId,
    todoKey: normalizeText(input.todoKey, null),
    action,
    ruleId,
    plan: normalizeText(input.plan, 'free') || 'free',
    traceId: normalizeText(input.traceId, null),
    requestId: normalizeText(input.requestId, null),
    actor: normalizeText(input.actor, 'journey_reaction_branch'),
    status: 'pending',
    attempts: 0,
    branchDispatchStatus: 'queued',
    lastError: null,
    nextAttemptAt: input.nextAttemptAt || new Date().toISOString(),
    dispatchedAt: null,
    effect: normalizeEffect(input.effect)
  });

  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, item, {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: true });

  return getJourneyBranchItem(id);
}

async function getJourneyBranchItem(id) {
  const docId = normalizeText(id, '');
  if (!docId) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  return normalizeQueueItem(docId, snap.data());
}

async function patchJourneyBranchItem(id, patch) {
  const docId = normalizeText(id, '');
  if (!docId) throw new Error('id required');
  const current = await getJourneyBranchItem(docId);
  if (!current) throw new Error('journey_branch_not_found');
  const merged = normalizeQueueItem(docId, Object.assign({}, current, patch || {}));
  if (!merged.lineUserId || !merged.deliveryId || !merged.ruleId || !merged.action) {
    throw new Error('invalid journeyBranchQueue');
  }
  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set(Object.assign({}, merged, {
    updatedAt: serverTimestamp()
  }), { merge: true });
  return getJourneyBranchItem(docId);
}

function resolveLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.min(Math.floor(num), max);
}

async function listJourneyBranchItems(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const status = payload.status ? normalizeStatus(payload.status, null) : null;
  if (payload.status && !status) throw new Error('invalid status');
  const lineUserId = normalizeText(payload.lineUserId, null);
  const limit = resolveLimit(payload.limit, 50, 500);
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);
  if (lineUserId) query = query.where('lineUserId', '==', lineUserId);
  query = query.orderBy('createdAt', 'desc').limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => normalizeQueueItem(doc.id, doc.data()));
}

async function listDispatchReadyJourneyBranches(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowIso = toIso(payload.now) || new Date().toISOString();
  const limit = resolveLimit(payload.limit, 100, 500);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('nextAttemptAt', '<=', nowIso)
    .orderBy('nextAttemptAt', 'asc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => normalizeQueueItem(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  ALLOWED_STATUS,
  normalizeQueueItem,
  enqueueJourneyBranch,
  getJourneyBranchItem,
  patchJourneyBranchItem,
  listJourneyBranchItems,
  listDispatchReadyJourneyBranches
};
