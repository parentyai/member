'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'task_nodes';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const ALLOWED_STATUS = Object.freeze(['not_started', 'in_progress', 'done', 'locked']);

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTaskId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildTaskNodeDocId(lineUserId, taskId) {
  const uid = normalizeLineUserId(lineUserId);
  const key = normalizeTaskId(taskId);
  if (!uid || !key) return '';
  return `${uid}__${key}`;
}

function parseTaskNodeDocId(docId) {
  const normalized = normalizeTaskId(docId);
  if (!normalized || !normalized.includes('__')) return { lineUserId: '', taskId: '' };
  const idx = normalized.indexOf('__');
  return {
    lineUserId: normalized.slice(0, idx),
    taskId: normalized.slice(idx + 2)
  };
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
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

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeText(value, fallback || 'not_started').toLowerCase();
  return ALLOWED_STATUS.includes(normalized) ? normalized : 'not_started';
}

function normalizeTaskNode(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const parsed = parseTaskNodeDocId(docId);
  const lineUserId = normalizeLineUserId(payload.lineUserId || parsed.lineUserId);
  const taskId = normalizeTaskId(payload.taskId || payload.todoKey || parsed.taskId);
  return {
    id: docId,
    lineUserId,
    taskId,
    todoKey: taskId,
    title: normalizeText(payload.title, null),
    status: normalizeStatus(payload.status, 'not_started'),
    todoStatus: normalizeText(payload.todoStatus, 'open'),
    progressState: normalizeText(payload.progressState, 'not_started'),
    graphStatus: normalizeText(payload.graphStatus, 'actionable'),
    dueAt: normalizeDate(payload.dueAt || payload.dueDate),
    dueDate: normalizeText(payload.dueDate, null),
    dependsOn: normalizeStringList(payload.dependsOn || payload.depends_on),
    blocks: normalizeStringList(payload.blocks),
    lockReasons: normalizeStringList(payload.lockReasons),
    priority: Math.max(1, Math.min(5, Math.floor(normalizeNumber(payload.priority, 3)))),
    riskLevel: normalizeText(payload.riskLevel, 'medium'),
    riskScore: Math.max(0, normalizeNumber(payload.riskScore, 0)),
    graphEvaluatedAt: normalizeDate(payload.graphEvaluatedAt),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null
  };
}

function resolveLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

async function getTaskNode(lineUserId, taskId) {
  const docId = buildTaskNodeDocId(lineUserId, taskId);
  if (!docId) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  return normalizeTaskNode(docId, snap.data());
}

async function upsertTaskNode(lineUserId, taskId, patch) {
  const docId = buildTaskNodeDocId(lineUserId, taskId);
  if (!docId) throw new Error('lineUserId/taskId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const normalized = normalizeTaskNode(docId, Object.assign({}, payload, {
    lineUserId: normalizeLineUserId(lineUserId),
    taskId: normalizeTaskId(taskId)
  }));
  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set(Object.assign({}, normalized, {
    createdAt: payload.createdAt || normalized.createdAt || serverTimestamp(),
    updatedAt: payload.updatedAt || serverTimestamp()
  }), { merge: true });
  return getTaskNode(lineUserId, taskId);
}

async function upsertTaskNodesBulk(lineUserId, nodes, options) {
  const lineUserIdNormalized = normalizeLineUserId(lineUserId);
  if (!lineUserIdNormalized) throw new Error('lineUserId required');
  const list = Array.isArray(nodes) ? nodes : [];
  const out = [];
  const payload = options && typeof options === 'object' ? options : {};
  for (const node of list) {
    const taskId = normalizeTaskId(node && (node.taskId || node.todoKey));
    if (!taskId) continue;
    // eslint-disable-next-line no-await-in-loop
    const saved = await upsertTaskNode(lineUserIdNormalized, taskId, Object.assign({}, node, {
      lineUserId: lineUserIdNormalized,
      taskId,
      updatedAt: payload.updatedAt || undefined
    }));
    out.push(saved);
  }
  return out;
}

async function listTaskNodesByLineUserId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) return [];
  const limit = resolveLimit(payload.limit, DEFAULT_LIMIT);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('lineUserId', '==', lineUserId)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => normalizeTaskNode(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  ALLOWED_STATUS,
  buildTaskNodeDocId,
  parseTaskNodeDocId,
  normalizeTaskNode,
  getTaskNode,
  upsertTaskNode,
  upsertTaskNodesBulk,
  listTaskNodesByLineUserId
};
