'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_todo_stats';
const IN_QUERY_CHUNK_SIZE = 10;

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
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

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeStats(lineUserId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const totalCount = Math.max(0, Math.floor(toNumber(payload.totalCount, 0)));
  const completedCount = Math.max(0, Math.floor(toNumber(payload.completedCount, 0)));
  const lockedCount = Math.max(0, Math.floor(toNumber(payload.lockedCount, 0)));
  const actionableCount = Math.max(0, Math.floor(toNumber(payload.actionableCount, 0)));
  const completionRateRaw = toNumber(payload.completionRate, totalCount > 0 ? completedCount / totalCount : 0);
  const dependencyBlockRateRaw = toNumber(payload.dependencyBlockRate, 0);
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    openCount: Math.max(0, Math.floor(toNumber(payload.openCount, 0))),
    totalCount,
    completedCount,
    lockedCount,
    actionableCount,
    completionRate: Math.max(0, Math.min(1, Math.round(completionRateRaw * 10000) / 10000)),
    dependencyBlockRate: Math.max(0, Math.min(1, Math.round(dependencyBlockRateRaw * 10000) / 10000)),
    overdueCount: Math.max(0, Math.floor(toNumber(payload.overdueCount, 0))),
    dueIn7DaysCount: Math.max(0, Math.floor(toNumber(payload.dueIn7DaysCount, 0))),
    nextDueAt: toIso(payload.nextDueAt),
    lastReminderAt: toIso(payload.lastReminderAt),
    updatedAt: payload.updatedAt || null
  };
}

function chunkList(list, size) {
  const out = [];
  const chunkSize = Math.max(1, Number(size) || IN_QUERY_CHUNK_SIZE);
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

async function getUserJourneyTodoStats(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return normalizeStats('', {});
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return normalizeStats(id, {});
  return normalizeStats(id, snap.data());
}

async function upsertUserJourneyTodoStats(lineUserId, patch) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const payload = patch && typeof patch === 'object' ? patch : {};
  const normalized = normalizeStats(id, payload);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: payload.updatedAt || serverTimestamp()
  }), { merge: true });
  return getUserJourneyTodoStats(id);
}

async function listUserJourneyTodoStatsByLineUserIds(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserIds = Array.from(new Set((Array.isArray(payload.lineUserIds) ? payload.lineUserIds : [])
    .map((id) => normalizeLineUserId(id))
    .filter(Boolean)));
  if (!lineUserIds.length) return [];
  const db = getDb();
  const rows = [];
  for (const chunk of chunkList(lineUserIds, IN_QUERY_CHUNK_SIZE)) {
    const docs = await Promise.all(chunk.map(async (lineUserId) => {
      const snap = await db.collection(COLLECTION).doc(lineUserId).get();
      if (!snap.exists) return null;
      return normalizeStats(lineUserId, snap.data());
    }));
    docs.filter(Boolean).forEach((row) => rows.push(row));
  }
  return rows;
}

module.exports = {
  COLLECTION,
  normalizeStats,
  getUserJourneyTodoStats,
  upsertUserJourneyTodoStats,
  listUserJourneyTodoStatsByLineUserIds
};
