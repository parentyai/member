'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_todo_items';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const DEFAULT_REMINDER_OFFSETS = Object.freeze([7, 3, 1]);
const ALLOWED_STATUS = Object.freeze(['open', 'completed', 'skipped']);

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
  const dueAt = toIso(payload.dueAt || payload.dueDate);
  return {
    id: docId,
    lineUserId,
    todoKey,
    title: normalizeString(payload.title, null),
    scenarioKey: normalizeString(payload.scenarioKey, null),
    householdType: normalizeString(payload.householdType, null),
    dueDate: toIsoDate(payload.dueDate || dueAt),
    dueAt,
    status: normalizeStatus(payload.status, 'open') || 'open',
    reminderOffsetsDays: normalizeReminderOffsetsDays(payload.reminderOffsetsDays, DEFAULT_REMINDER_OFFSETS) || DEFAULT_REMINDER_OFFSETS.slice(),
    remindedOffsetsDays: normalizeReminderOffsetsDays(payload.remindedOffsetsDays, []) || [],
    nextReminderAt: toIso(payload.nextReminderAt),
    lastReminderAt: toIso(payload.lastReminderAt),
    reminderCount: Number.isFinite(Number(payload.reminderCount)) ? Math.max(0, Math.floor(Number(payload.reminderCount))) : 0,
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
  const normalized = normalizeTodoItem(docId, Object.assign({}, payload, {
    lineUserId: normalizeLineUserId(lineUserId),
    todoKey: normalizeTodoKey(todoKey)
  }));

  if (payload.status !== undefined && normalized.status === null) throw new Error('invalid status');
  if (payload.dueDate !== undefined && payload.dueDate !== null && payload.dueDate !== '' && !normalized.dueDate) throw new Error('invalid dueDate');
  if (payload.dueAt !== undefined && payload.dueAt !== null && payload.dueAt !== '' && !normalized.dueAt) throw new Error('invalid dueAt');
  if (payload.nextReminderAt !== undefined && payload.nextReminderAt !== null && payload.nextReminderAt !== '' && !normalized.nextReminderAt) throw new Error('invalid nextReminderAt');

  const db = getDb();
  await db.collection(COLLECTION).doc(docId).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp(),
    createdAt: payload.createdAt || normalized.createdAt || serverTimestamp()
  }), { merge: true });
  return getJourneyTodoItem(lineUserId, todoKey);
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
    completedAt,
    nextReminderAt: null,
    updatedAt: payload.updatedAt || serverTimestamp()
  }, { merge: true });
  return getJourneyTodoItem(lineUserId, todoKey);
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
  buildTodoDocId,
  parseTodoDocId,
  normalizeTodoItem,
  getJourneyTodoItem,
  upsertJourneyTodoItem,
  markJourneyTodoCompleted,
  listJourneyTodoItemsByLineUserId,
  listDueJourneyTodoItems
};
