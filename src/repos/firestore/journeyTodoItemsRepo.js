'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_todo_items';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const DEFAULT_REMINDER_OFFSETS = Object.freeze([7, 3, 1]);
const ALLOWED_STATUS = Object.freeze(['open', 'completed', 'skipped']);
const ALLOWED_PROGRESS_STATE = Object.freeze(['not_started', 'in_progress']);
const ALLOWED_GRAPH_STATUS = Object.freeze(['actionable', 'locked', 'done']);
const ALLOWED_RISK_LEVEL = Object.freeze(['low', 'medium', 'high']);
const ALLOWED_JOURNEY_STATE = Object.freeze(['planned', 'in_progress', 'done', 'blocked', 'snoozed', 'skipped']);
const ALLOWED_PLAN_TIER = Object.freeze(['all', 'pro']);

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTodoKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildTodoDocId(lineUserId, todoKey) {
  const uid = normalizeLineUserId(lineUserId);
  const key = normalizeTodoKey(todoKey);
  if (!uid || !key) return '';
  return `${uid}__${key}`;
}

function parseTodoDocId(docId) {
  const normalized = typeof docId === 'string' ? docId.trim() : '';
  if (!normalized || !normalized.includes('__')) return { lineUserId: '', todoKey: '' };
  const idx = normalized.indexOf('__');
  return {
    lineUserId: normalized.slice(0, idx),
    todoKey: normalized.slice(idx + 2)
  };
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function toIsoDate(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeStatus(value, fallback) {
  const normalized = normalizeString(value, fallback || 'open');
  if (normalized === null || normalized === '') return 'open';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATUS.includes(lowered)) return null;
  return lowered;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeString(item, '');
    if (normalized === null || normalized === '') return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeDependencyReasonMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.keys(value).forEach((key) => {
    const depKey = normalizeString(key, '');
    if (depKey === null || depKey === '') return;
    const reason = normalizeString(value[key], '');
    if (reason === null || reason === '') return;
    out[depKey] = reason;
  });
  return out;
}

function normalizeProgressState(value, fallback) {
  const normalized = normalizeString(value, fallback || 'not_started');
  if (normalized === null || normalized === '') return 'not_started';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_PROGRESS_STATE.includes(lowered)) return null;
  return lowered;
}

function normalizeGraphStatus(value, fallback) {
  const normalized = normalizeString(value, fallback || 'actionable');
  if (normalized === null || normalized === '') return 'actionable';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_GRAPH_STATUS.includes(lowered)) return null;
  return lowered;
}

function normalizePriority(value, fallback) {
  const base = value === undefined ? fallback : value;
  const parsed = Number(base);
  if (!Number.isFinite(parsed)) return null;
  const intValue = Math.floor(parsed);
  if (intValue < 1 || intValue > 5) return null;
  return intValue;
}

function normalizeRiskLevel(value, fallback) {
  const normalized = normalizeString(value, fallback || 'medium');
  if (normalized === null || normalized === '') return 'medium';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_RISK_LEVEL.includes(lowered)) return null;
  return lowered;
}

function normalizeJourneyState(value, fallback) {
  const normalized = normalizeString(value, fallback || 'planned');
  if (normalized === null || normalized === '') return 'planned';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_JOURNEY_STATE.includes(lowered)) return null;
  return lowered;
}

function normalizePlanTier(value, fallback) {
  const normalized = normalizeString(value, fallback || 'all');
  if (normalized === null || normalized === '') return 'all';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_PLAN_TIER.includes(lowered)) return null;
  return lowered;
}

function normalizeSignal(value, fallback) {
  const normalized = normalizeString(value, fallback || null);
  if (normalized === null || normalized === '') return null;
  return normalized.toLowerCase();
}

function normalizeReminderOffsetsDays(values, fallback) {
  const raw = values === null || values === undefined ? fallback : values;
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((value) => {
    const num = Number(value);
    if (!Number.isInteger(num)) return;
    if (num < 0 || num > 365) return;
    if (!out.includes(num)) out.push(num);
  });
  return out;
}

function normalizeTodoItem(docId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const parsed = parseTodoDocId(docId);
  const lineUserId = normalizeLineUserId(payload.lineUserId || parsed.lineUserId);
  const todoKey = normalizeTodoKey(payload.todoKey || parsed.todoKey);
  const status = normalizeStatus(payload.status, 'open') || 'open';
  const dueAt = toIso(payload.dueAt || payload.dueDate);
  const done = status === 'completed' || status === 'skipped';
  const progressState = normalizeProgressState(payload.progressState, done ? 'in_progress' : 'not_started')
    || (done ? 'in_progress' : 'not_started');
  const graphStatus = normalizeGraphStatus(payload.graphStatus, done ? 'done' : 'actionable')
    || (done ? 'done' : 'actionable');
  const journeyState = normalizeJourneyState(
    payload.journeyState,
    status === 'completed' ? 'done' : (status === 'skipped' ? 'skipped' : 'planned')
  ) || (status === 'completed' ? 'done' : (status === 'skipped' ? 'skipped' : 'planned'));
  const priority = normalizePriority(payload.priority, 3) || 3;
  const riskLevel = normalizeRiskLevel(payload.riskLevel, 'medium') || 'medium';
  const planTier = normalizePlanTier(payload.planTier, 'all') || 'all';
  return {
    id: docId,
    lineUserId,
    todoKey,
    title: normalizeString(payload.title, null),
    scenarioKey: normalizeString(payload.scenarioKey, null),
    householdType: normalizeString(payload.householdType, null),
    dueDate: toIsoDate(payload.dueDate || dueAt),
    dueAt,
    status,
    progressState,
    graphStatus,
    journeyState,
    phaseKey: normalizeString(payload.phaseKey, null),
    domainKey: normalizeString(payload.domainKey, null),
    planTier,
    dependsOn: normalizeStringList(payload.dependsOn || payload.depends_on),
    blocks: normalizeStringList(payload.blocks),
    priority,
    riskLevel,
    lockReasons: normalizeStringList(payload.lockReasons),
    dependencyReasonMap: normalizeDependencyReasonMap(payload.dependencyReasonMap),
    graphEvaluatedAt: toIso(payload.graphEvaluatedAt),
    reminderOffsetsDays: normalizeReminderOffsetsDays(payload.reminderOffsetsDays, DEFAULT_REMINDER_OFFSETS) || DEFAULT_REMINDER_OFFSETS.slice(),
    remindedOffsetsDays: normalizeReminderOffsetsDays(payload.remindedOffsetsDays, []) || [],
    nextReminderAt: toIso(payload.nextReminderAt),
    lastReminderAt: toIso(payload.lastReminderAt),
    reminderCount: Number.isFinite(Number(payload.reminderCount)) ? Math.max(0, Math.floor(Number(payload.reminderCount))) : 0,
    snoozeUntil: toIso(payload.snoozeUntil),
    lastSignal: normalizeSignal(payload.lastSignal, null),
    stateEvidenceRef: normalizeString(payload.stateEvidenceRef, null),
    stateUpdatedAt: toIso(payload.stateUpdatedAt),
    sourceTemplateVersion: normalizeString(payload.sourceTemplateVersion, null),
    completedAt: toIso(payload.completedAt),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    source: normalizeString(payload.source, null)
  };
}

function resolveLimit(value, fallback) {
  const base = Number(value);
  if (!Number.isFinite(base) || base < 1) return fallback;
  return Math.min(Math.floor(base), MAX_LIMIT);
}

async function getJourneyTodoItem(lineUserId, todoKey) {
  const docId = buildTodoDocId(lineUserId, todoKey);
  if (!docId) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  return normalizeTodoItem(docId, snap.data());
}

async function upsertJourneyTodoItem(lineUserId, todoKey, patch) {
  const docId = buildTodoDocId(lineUserId, todoKey);
  if (!docId) throw new Error('lineUserId/todoKey required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const existing = await getJourneyTodoItem(lineUserId, todoKey);
  const normalized = normalizeTodoItem(docId, Object.assign({}, existing || {}, payload, {
    lineUserId: normalizeLineUserId(lineUserId),
    todoKey: normalizeTodoKey(todoKey)
  }));

  if (payload.status !== undefined && normalizeStatus(payload.status, null) === null) throw new Error('invalid status');
  if (payload.progressState !== undefined && normalizeProgressState(payload.progressState, null) === null) throw new Error('invalid progressState');
  if (payload.graphStatus !== undefined && normalizeGraphStatus(payload.graphStatus, null) === null) throw new Error('invalid graphStatus');
  if (payload.priority !== undefined && normalizePriority(payload.priority, null) === null) throw new Error('invalid priority');
  if (payload.riskLevel !== undefined && normalizeRiskLevel(payload.riskLevel, null) === null) throw new Error('invalid riskLevel');
  if (payload.journeyState !== undefined && normalizeJourneyState(payload.journeyState, null) === null) throw new Error('invalid journeyState');
  if (payload.planTier !== undefined && normalizePlanTier(payload.planTier, null) === null) throw new Error('invalid planTier');
  if (payload.dueDate !== undefined && payload.dueDate !== null && payload.dueDate !== '' && !normalized.dueDate) throw new Error('invalid dueDate');
  if (payload.dueAt !== undefined && payload.dueAt !== null && payload.dueAt !== '' && !normalized.dueAt) throw new Error('invalid dueAt');
  if (payload.nextReminderAt !== undefined && payload.nextReminderAt !== null && payload.nextReminderAt !== '' && !normalized.nextReminderAt) throw new Error('invalid nextReminderAt');
  if (payload.snoozeUntil !== undefined && payload.snoozeUntil !== null && payload.snoozeUntil !== '' && !normalized.snoozeUntil) throw new Error('invalid snoozeUntil');
  if (payload.stateUpdatedAt !== undefined && payload.stateUpdatedAt !== null && payload.stateUpdatedAt !== '' && !normalized.stateUpdatedAt) throw new Error('invalid stateUpdatedAt');

  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp(),
    createdAt: payload.createdAt || normalized.createdAt || serverTimestamp()
  }), { merge: true });
  return getJourneyTodoItem(lineUserId, todoKey);
}

async function patchJourneyTodoItem(lineUserId, todoKey, patch) {
  return upsertJourneyTodoItem(lineUserId, todoKey, patch);
}

async function markJourneyTodoCompleted(lineUserId, todoKey, options) {
  const docId = buildTodoDocId(lineUserId, todoKey);
  if (!docId) throw new Error('lineUserId/todoKey required');
  const payload = options && typeof options === 'object' ? options : {};
  const completedAt = toIso(payload.completedAt) || new Date().toISOString();
  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set({
    lineUserId: normalizeLineUserId(lineUserId),
    todoKey: normalizeTodoKey(todoKey),
    status: 'completed',
    progressState: 'in_progress',
    graphStatus: 'done',
    lockReasons: [],
    graphEvaluatedAt: completedAt,
    completedAt,
    nextReminderAt: null,
    updatedAt: payload.updatedAt || serverTimestamp()
  }, { merge: true });
  return getJourneyTodoItem(lineUserId, todoKey);
}

async function setJourneyTodoProgressState(lineUserId, todoKey, progressState, options) {
  const normalizedProgress = normalizeProgressState(progressState, null);
  if (!normalizedProgress) throw new Error('invalid progressState');
  const existing = await getJourneyTodoItem(lineUserId, todoKey);
  if (!existing) throw new Error('todo_not_found');
  if (existing.status === 'completed' || existing.status === 'skipped') {
    throw new Error('todo_already_done');
  }
  const payload = options && typeof options === 'object' ? options : {};
  return patchJourneyTodoItem(lineUserId, todoKey, {
    progressState: normalizedProgress,
    graphStatus: 'actionable',
    updatedAt: payload.updatedAt || undefined
  });
}

async function listJourneyTodoItemsByLineUserId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) return [];
  const status = payload.status ? normalizeStatus(payload.status, null) : null;
  if (payload.status && !status) throw new Error('invalid status');
  const limit = resolveLimit(payload.limit, DEFAULT_LIMIT);
  const db = getDb();
  let query = db.collection(COLLECTION).where('lineUserId', '==', lineUserId);
  if (status) query = query.where('status', '==', status);
  const snap = await query.orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => normalizeTodoItem(doc.id, doc.data()));
}

async function listDueJourneyTodoItems(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const beforeAt = toIso(payload.beforeAt) || new Date().toISOString();
  const limit = resolveLimit(payload.limit, 100);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('status', '==', 'open')
    .where('nextReminderAt', '<=', beforeAt)
    .orderBy('nextReminderAt', 'asc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => normalizeTodoItem(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  DEFAULT_REMINDER_OFFSETS,
  ALLOWED_STATUS,
  ALLOWED_PROGRESS_STATE,
  ALLOWED_GRAPH_STATUS,
  ALLOWED_RISK_LEVEL,
  ALLOWED_JOURNEY_STATE,
  ALLOWED_PLAN_TIER,
  buildTodoDocId,
  parseTodoDocId,
  normalizeTodoItem,
  getJourneyTodoItem,
  upsertJourneyTodoItem,
  patchJourneyTodoItem,
  markJourneyTodoCompleted,
  setJourneyTodoProgressState,
  listJourneyTodoItemsByLineUserId,
  listDueJourneyTodoItems
};
