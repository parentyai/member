'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeTaskCategory } = require('../../domain/tasks/taskCategories');
const {
  isTaskCategorySystemEnabled,
  getTaskDependencyMax
} = require('../../domain/tasks/featureFlags');

const COLLECTION = 'task_contents';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
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

function resolveLimit(value) {
  const parsed = normalizeNumber(value, DEFAULT_LIMIT, 1, MAX_LIMIT);
  return Number.isInteger(parsed) ? parsed : DEFAULT_LIMIT;
}

function normalizeChecklistItems(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((row, index) => {
    const item = row && typeof row === 'object' ? row : {};
    const id = normalizeText(item.id, `item_${index + 1}`);
    const text = normalizeText(item.text, null);
    if (!text) return;
    const order = normalizeNumber(item.order, index + 1, 1, 1000000) || (index + 1);
    const enabled = normalizeBoolean(item.enabled, true) !== false;
    out.push({ id, text, order, enabled });
  });
  out.sort((left, right) => {
    const orderCompare = Number(left.order || 0) - Number(right.order || 0);
    if (orderCompare !== 0) return orderCompare;
    return String(left.id || '').localeCompare(String(right.id || ''), 'ja');
  });
  return out;
}

function normalizeStringList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const text = normalizeText(item, null);
    if (!text) return;
    if (out.includes(text)) return;
    out.push(text);
  });
  if (!Number.isInteger(maxItems) || maxItems < 1) return out;
  return out.slice(0, maxItems);
}

function normalizeTextList(value, maxItems) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const text = normalizeText(item, null);
    if (!text) return;
    if (out.includes(text)) return;
    out.push(text.slice(0, 300));
  });
  if (!Number.isInteger(maxItems) || maxItems < 1) return out;
  return out.slice(0, maxItems);
}

function normalizeChecklistTextList(value) {
  return normalizeStringList(value, 50).map((item) => item.slice(0, 300));
}

function deriveChecklistItemsFromChecklist(checklist) {
  const rows = Array.isArray(checklist) ? checklist : [];
  return rows.map((text, index) => ({
    id: `item_${index + 1}`,
    text,
    order: index + 1,
    enabled: true
  }));
}

function deriveChecklistFromItems(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .filter((item) => item && item.enabled !== false && normalizeText(item.text, null))
    .map((item) => normalizeText(item.text, null))
    .filter(Boolean);
}

function normalizeTaskContent(taskKey, data) {
  const id = normalizeText(taskKey || (data && data.taskKey), '');
  if (!id) return null;
  const payload = data && typeof data === 'object' ? data : {};
  const timeMin = normalizeNumber(payload.timeMin, null, 0, 24 * 60);
  const timeMax = normalizeNumber(payload.timeMax, null, 0, 24 * 60);
  const dependencyMax = getTaskDependencyMax();
  const dependencies = normalizeStringList(payload.dependencies, dependencyMax);
  const recommendedVendorLinkIds = normalizeStringList(payload.recommendedVendorLinkIds, 3);
  const category = isTaskCategorySystemEnabled()
    ? normalizeTaskCategory(payload.category, 'LIFE_SETUP')
    : normalizeTaskCategory(payload.category, null);
  const checklistItemsFromPayload = normalizeChecklistItems(payload.checklistItems);
  const checklistFromPayload = normalizeChecklistTextList(payload.checklist);
  const checklistItems = checklistItemsFromPayload.length
    ? checklistItemsFromPayload
    : deriveChecklistItemsFromChecklist(checklistFromPayload);
  const checklist = checklistFromPayload.length
    ? checklistFromPayload
    : deriveChecklistFromItems(checklistItems);
  return {
    id,
    taskKey: id,
    title: normalizeText(payload.title, null),
    whyNow: normalizeText(payload.whyNow, null),
    category,
    dependencies,
    timeMin: Number.isInteger(timeMin) ? timeMin : null,
    timeMax: Number.isInteger(timeMax) ? timeMax : null,
    checklistItems,
    checklist,
    manualText: normalizeText(payload.manualText, null),
    failureText: normalizeText(payload.failureText, null),
    summaryShort: normalizeTextList(payload.summaryShort, 5),
    topMistakes: normalizeTextList(payload.topMistakes, 3),
    contextTips: normalizeTextList(payload.contextTips, 5),
    recommendedVendorLinkIds,
    archived: normalizeBoolean(payload.archived, false) === true,
    videoLinkId: normalizeText(payload.videoLinkId, null),
    actionLinkId: normalizeText(payload.actionLinkId, null),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedBy: normalizeText(payload.updatedBy, null)
  };
}

async function getTaskContent(taskKey) {
  const id = normalizeText(taskKey, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeTaskContent(id, snap.data());
}

async function upsertTaskContent(taskKey, patch, actor) {
  const id = normalizeText(taskKey, '');
  if (!id) throw new Error('taskKey required');
  const existing = await getTaskContent(id);
  const normalized = normalizeTaskContent(id, Object.assign({}, existing || {}, patch || {}, { taskKey: id }));
  if (!normalized) throw new Error('invalid task content');
  const normalizedActor = normalizeText(actor, null);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: normalized.createdBy || normalizedActor,
    updatedBy: normalizedActor || normalized.updatedBy
  }), { merge: true });
  return getTaskContent(id);
}

async function listTaskContents(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = resolveLimit(payload.limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => normalizeTaskContent(doc.id, doc.data())).filter(Boolean);
}

module.exports = {
  COLLECTION,
  normalizeTaskContent,
  getTaskContent,
  upsertTaskContent,
  listTaskContents
};
