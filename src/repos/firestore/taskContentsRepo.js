'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');
const { normalizeTaskCategory } = require('../../domain/tasks/usExpatTaxonomy');
const { getTaskDependencyMax } = require('../../domain/tasks/featureFlags');

const COLLECTION = 'task_contents';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_CHECKLIST_ITEMS = 30;
const MAX_VENDOR_LINKS = 3;

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

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeStringList(value, limit) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const row of value) {
    const normalized = normalizeText(row, '');
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (Number.isFinite(limit) && out.length >= limit) break;
  }
  return out;
}

function normalizeChecklistItems(rawChecklistItems, rawChecklist) {
  const maxItems = MAX_CHECKLIST_ITEMS;
  const source = Array.isArray(rawChecklistItems) && rawChecklistItems.length
    ? rawChecklistItems
    : normalizeStringList(rawChecklist, maxItems).map((text, index) => ({
      id: `item_${index + 1}`,
      text,
      order: index + 1,
      enabled: true
    }));

  const rows = [];
  source.forEach((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const text = normalizeText(row.text, '');
    if (!text) return;
    const id = normalizeText(row.id, `item_${index + 1}`);
    const order = normalizeNumber(row.order, index + 1, 1, 9999);
    const enabled = normalizeBoolean(row.enabled, true);
    rows.push({ id, text, order, enabled });
  });
  rows.sort((a, b) => a.order - b.order);
  return rows.slice(0, maxItems);
}

function normalizeTaskContent(taskKey, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const key = normalizeText(taskKey || payload.taskKey, '');
  if (!key) return null;

  const checklistItems = normalizeChecklistItems(payload.checklistItems, payload.checklist);
  const checklist = checklistItems
    .filter((item) => item.enabled !== false)
    .map((item) => item.text)
    .slice(0, MAX_CHECKLIST_ITEMS);

  return {
    id: key,
    taskKey: key,
    title: normalizeText(payload.title, key),
    category: normalizeTaskCategory(payload.category, null),
    dependencies: normalizeStringList(payload.dependencies, getTaskDependencyMax()),
    timeMin: normalizeNumber(payload.timeMin || payload.estimatedTimeMin, null, 0, 1440),
    timeMax: normalizeNumber(payload.timeMax || payload.estimatedTimeMax, null, 0, 1440),
    checklistItems,
    checklist,
    summaryShort: normalizeStringList(payload.summaryShort, 5),
    topMistakes: normalizeStringList(payload.topMistakes, 3),
    contextTips: normalizeStringList(payload.contextTips, 5),
    manualText: normalizeText(payload.manualText, null),
    failureText: normalizeText(payload.failureText, null),
    videoLinkId: normalizeText(payload.videoLinkId, null),
    actionLinkId: normalizeText(payload.actionLinkId, null),
    recommendedVendorLinkIds: normalizeStringList(payload.recommendedVendorLinkIds, MAX_VENDOR_LINKS),
    archived: normalizeBoolean(payload.archived, false) === true,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedBy: normalizeText(payload.updatedBy, null)
  };
}

function resolveLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

async function getTaskContent(taskKey) {
  const key = normalizeText(taskKey, '');
  if (!key) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  return normalizeTaskContent(key, snap.data());
}

async function upsertTaskContent(taskKey, patch, actor) {
  const key = normalizeText(taskKey, '');
  if (!key) throw new Error('taskKey required');
  const existing = await getTaskContent(key);
  const normalized = normalizeTaskContent(key, Object.assign({}, existing || {}, patch || {}, { taskKey: key }));
  if (!normalized) throw new Error('invalid task content');
  const db = getDb();
  await db.collection(COLLECTION).doc(key).set(Object.assign({}, normalized, {
    createdAt: normalized.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: normalized.createdBy || normalizeText(actor, null),
    updatedBy: normalizeText(actor, normalized.updatedBy)
  }), { merge: true });
  return getTaskContent(key);
}

async function listTaskContents(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = resolveLimit(payload.limit);
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => normalizeTaskContent(doc.id, doc.data()))
    .filter(Boolean);
}

module.exports = {
  COLLECTION,
  normalizeTaskContent,
  getTaskContent,
  upsertTaskContent,
  listTaskContents
};
