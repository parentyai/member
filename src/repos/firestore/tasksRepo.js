'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { TASK_STATUS, TASK_STATUS_VALUES } = require('../../domain/tasks/constants');

const COLLECTION = 'tasks';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const num = Math.floor(parsed);
  if (Number.isFinite(min) && num < min) return fallback;
  if (Number.isFinite(max) && num > max) return fallback;
  return num;
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

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || TASK_STATUS.TODO).toLowerCase();
  if (!TASK_STATUS_VALUES.includes(normalized)) return fallback || TASK_STATUS.TODO;
  return normalized;
}

function buildTaskId(userId, ruleId) {
  const uid = normalizeText(userId, '');
  const rid = normalizeText(ruleId, '');
  if (!uid || !rid) return '';
  return `${uid}__${rid}`;
}

function parseTaskId(taskId) {
  const normalized = normalizeText(taskId, '');
  if (!normalized || !normalized.includes('__')) return { userId: '', ruleId: '' };
  const idx = normalized.indexOf('__');
  return {
    userId: normalized.slice(0, idx),
    ruleId: normalized.slice(idx + 2)
  };
}

function normalizeTask(taskId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const parsed = parseTaskId(taskId || payload.taskId);
  const id = normalizeText(taskId || payload.taskId, '');
  if (!id) return null;
  return {
    id,
    taskId: id,
    userId: normalizeText(payload.userId || payload.lineUserId || parsed.userId, null),
    lineUserId: normalizeText(payload.lineUserId || payload.userId || parsed.userId, null),
    scenarioKey: normalizeText(payload.scenarioKey, null),
    stepKey: normalizeText(payload.stepKey, null),
    ruleId: normalizeText(payload.ruleId || parsed.ruleId, null),
    status: normalizeStatus(payload.status, TASK_STATUS.TODO),
    dueAt: toIso(payload.dueAt),
    nextNudgeAt: toIso(payload.nextNudgeAt),
    blockedReason: normalizeText(payload.blockedReason, null),
    sourceEvent: payload.sourceEvent && typeof payload.sourceEvent === 'object'
      ? {
        eventId: normalizeText(payload.sourceEvent.eventId, null),
        eventKey: normalizeText(payload.sourceEvent.eventKey, null),
        source: normalizeText(payload.sourceEvent.source, null),
        occurredAt: toIso(payload.sourceEvent.occurredAt)
      }
      : null,
    engineVersion: normalizeText(payload.engineVersion, 'task_engine_v1'),
    decisionHash: normalizeText(payload.decisionHash, null),
    checkedAt: toIso(payload.checkedAt),
    nudgeCount: normalizeNumber(payload.nudgeCount, 0, 0, 100000) || 0,
    lastNotifiedAt: toIso(payload.lastNotifiedAt),
    explain: Array.isArray(payload.explain) ? payload.explain.slice(0, 100) : [],
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null
  };
}

function resolveLimit(value, fallback) {
  const parsed = normalizeNumber(value, fallback, 1, MAX_LIMIT);
  return Number.isInteger(parsed) ? parsed : fallback;
}

async function getTask(taskId) {
  const id = normalizeText(taskId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeTask(id, snap.data());
}

async function upsertTask(taskId, patch) {
  const id = normalizeText(taskId, '');
  if (!id) throw new Error('taskId required');
  const existing = await getTask(id);
  const normalized = normalizeTask(id, Object.assign({}, existing || {}, patch || {}, { taskId: id }));
  if (!normalized) throw new Error('invalid task');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: true });
  return getTask(id);
}

async function patchTask(taskId, patch) {
  return upsertTask(taskId, patch);
}

async function upsertTasksBulk(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const out = [];
  for (const item of list) {
    const userId = normalizeText(item && (item.userId || item.lineUserId), '');
    const ruleId = normalizeText(item && item.ruleId, '');
    const explicitTaskId = normalizeText(item && item.taskId, '');
    const taskId = explicitTaskId || buildTaskId(userId, ruleId);
    if (!taskId) continue;
    // eslint-disable-next-line no-await-in-loop
    const saved = await upsertTask(taskId, Object.assign({}, item, {
      userId,
      lineUserId: userId,
      ruleId,
      taskId
    }));
    out.push(saved);
  }
  return out;
}

async function listTasksByUser(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const userId = normalizeText(payload.userId || payload.lineUserId, '');
  if (!userId) return [];
  const limit = resolveLimit(payload.limit, DEFAULT_LIMIT);
  const db = getDb();
  let query = db.collection(COLLECTION).where('userId', '==', userId);
  if (payload.status) query = query.where('status', '==', normalizeStatus(payload.status, TASK_STATUS.TODO));
  const snap = await query.orderBy('dueAt', 'asc').limit(limit).get();
  return snap.docs.map((doc) => normalizeTask(doc.id, doc.data())).filter(Boolean);
}

async function listDueTasks(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const beforeAt = toIso(payload.beforeAt || new Date().toISOString());
  if (!beforeAt) throw new Error('beforeAt required');
  const limit = resolveLimit(payload.limit, 100);
  const db = getDb();
  let query = db.collection(COLLECTION)
    .where('status', 'in', [TASK_STATUS.TODO, TASK_STATUS.DOING])
    .where('nextNudgeAt', '<=', beforeAt)
    .orderBy('nextNudgeAt', 'asc')
    .limit(limit);
  const snap = await query.get();
  return snap.docs.map((doc) => normalizeTask(doc.id, doc.data())).filter(Boolean);
}

module.exports = {
  COLLECTION,
  TASK_STATUS,
  TASK_STATUS_VALUES,
  buildTaskId,
  parseTaskId,
  normalizeTask,
  getTask,
  upsertTask,
  patchTask,
  upsertTasksBulk,
  listTasksByUser,
  listDueTasks
};
