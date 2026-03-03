'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'task_events';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const DECISION_VALUES = Object.freeze(['created', 'updated', 'status_changed', 'blocked']);
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeDecision(value, fallback) {
  const normalized = normalizeText(value, fallback || 'updated');
  if (!DECISION_VALUES.includes(normalized)) return fallback || 'updated';
  return normalized;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function buildTaskEventId(taskId) {
  const taskPart = normalizeText(taskId, 'task').replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 64);
  return `${taskPart}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function normalizeTaskEvent(eventId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const id = normalizeText(eventId || payload.eventId, '');
  if (!id) return null;
  return {
    id,
    eventId: id,
    taskId: normalizeText(payload.taskId, null),
    userId: normalizeText(payload.userId || payload.lineUserId, null),
    lineUserId: normalizeText(payload.lineUserId || payload.userId, null),
    ruleId: normalizeText(payload.ruleId, null),
    [FIELD_SCK]: normalizeText(payload[FIELD_SCK], null),
    stepKey: normalizeText(payload.stepKey, null),
    decision: normalizeDecision(payload.decision, 'updated'),
    beforeStatus: normalizeText(payload.beforeStatus, null),
    afterStatus: normalizeText(payload.afterStatus, null),
    beforeBlockedReason: normalizeText(payload.beforeBlockedReason, null),
    afterBlockedReason: normalizeText(payload.afterBlockedReason, null),
    checkedAt: toIso(payload.checkedAt),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    actor: normalizeText(payload.actor, 'unknown'),
    source: normalizeText(payload.source, 'task_engine_v1'),
    explainKeys: normalizeStringList(payload.explainKeys),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null
  };
}

async function appendTaskEvent(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const eventId = normalizeText(payload.eventId, '') || buildTaskEventId(payload.taskId);
  const normalized = normalizeTaskEvent(eventId, Object.assign({}, payload, { eventId }));
  if (!normalized) throw new Error('invalid task event');
  const db = getDb();
  await db.collection(COLLECTION).doc(eventId).set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: false });
  return Object.assign({}, normalized, { createdAt: normalized.createdAt || new Date().toISOString() });
}

async function listTaskEventsByTask(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const taskId = normalizeText(payload.taskId, '');
  if (!taskId) return [];
  const db = getDb();
  const cap = normalizeLimit(payload.limit);
  const snap = await db.collection(COLLECTION)
    .where('taskId', '==', taskId)
    .orderBy('checkedAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((doc) => normalizeTaskEvent(doc.id, doc.data())).filter(Boolean);
}

async function listTaskEventsByUser(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId, '');
  if (!lineUserId) return [];
  const db = getDb();
  const cap = normalizeLimit(payload.limit);
  const snap = await db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .orderBy('checkedAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.map((doc) => normalizeTaskEvent(doc.id, doc.data())).filter(Boolean);
}

module.exports = {
  COLLECTION,
  DECISION_VALUES,
  normalizeTaskEvent,
  appendTaskEvent,
  listTaskEventsByTask,
  listTaskEventsByUser
};
