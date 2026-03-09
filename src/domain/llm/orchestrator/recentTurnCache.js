'use strict';

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_USERS = 800;
const MAX_ROWS_PER_USER = 12;

const cache = new Map();

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  return 0;
}

function pruneRowList(rows, now) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object')
    .filter((row) => {
      const createdAt = toMillis(row.createdAt);
      return createdAt > 0 && (now - createdAt) <= CACHE_TTL_MS;
    })
    .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
    .slice(0, MAX_ROWS_PER_USER);
}

function toCacheRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const createdAt = toMillis(row.createdAt) || Date.now();
  return {
    createdAt: new Date(createdAt).toISOString(),
    requestId: normalizeText(row.requestId) || null,
    traceId: normalizeText(row.traceId) || null,
    domainIntent: normalizeText(row.domainIntent).toLowerCase() || 'general',
    followupIntent: normalizeText(row.followupIntent).toLowerCase() || null,
    replyText: normalizeText(row.replyText) || '',
    committedNextActions: Array.isArray(row.committedNextActions) ? row.committedNextActions.slice(0, 3) : [],
    committedFollowupQuestion: normalizeText(row.committedFollowupQuestion) || null,
    recentUserGoal: normalizeText(row.recentUserGoal) || null
  };
}

function upsertRecentTurn(lineUserId, payload) {
  const userId = normalizeText(lineUserId);
  if (!userId) return;
  const now = Date.now();
  const current = pruneRowList(cache.get(userId), now);
  const row = toCacheRow(payload);
  const deduped = current.filter((item) => {
    if (!item) return false;
    if (row.requestId && item.requestId && row.requestId === item.requestId) return false;
    return !(row.replyText && item.replyText && row.replyText === item.replyText && row.domainIntent === item.domainIntent);
  });
  const next = pruneRowList([row].concat(deduped), now);
  cache.set(userId, next);
  if (cache.size > MAX_USERS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

function listRecentTurns(lineUserId, limit) {
  const userId = normalizeText(lineUserId);
  if (!userId) return [];
  const now = Date.now();
  const rows = pruneRowList(cache.get(userId), now);
  cache.set(userId, rows);
  const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 10;
  return rows.slice(0, max).map((row) => Object.assign({}, row));
}

function clearRecentTurns(lineUserId) {
  const userId = normalizeText(lineUserId);
  if (!userId) return;
  cache.delete(userId);
}

module.exports = {
  upsertRecentTurn,
  listRecentTurns,
  clearRecentTurns
};
