'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'llm_usage_stats';
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

function toDateKey(value) {
  const iso = toIso(value) || new Date().toISOString();
  return iso.slice(0, 10);
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeStats(lineUserId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    usageCount: toNumber(payload.usageCount, 0),
    totalTokensIn: toNumber(payload.totalTokensIn, 0),
    totalTokensOut: toNumber(payload.totalTokensOut, 0),
    totalTokenUsed: toNumber(payload.totalTokenUsed, toNumber(payload.totalTokensIn, 0) + toNumber(payload.totalTokensOut, 0)),
    blockedCount: toNumber(payload.blockedCount, 0),
    lastUsedAt: toIso(payload.lastUsedAt),
    dailyDate: typeof payload.dailyDate === 'string' && payload.dailyDate.trim() ? payload.dailyDate.trim() : null,
    dailyUsageCount: toNumber(payload.dailyUsageCount, 0),
    dailyTokenUsed: toNumber(payload.dailyTokenUsed, 0),
    blockedHistory: Array.isArray(payload.blockedHistory) ? payload.blockedHistory.slice(0, 10) : [],
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

function shouldCountAsBlocked(decision) {
  return String(decision || '').toLowerCase() !== 'allow';
}

async function getUserUsageStats(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return normalizeStats('', {});
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return normalizeStats(id, {});
  return normalizeStats(id, snap.data());
}

async function listUserUsageStatsByLineUserIds(params) {
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

async function incrementUserUsageStats(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');

  const tokensIn = Math.max(0, toNumber(payload.tokensIn, 0));
  const tokensOut = Math.max(0, toNumber(payload.tokensOut, 0));
  const tokenUsed = Math.max(0, toNumber(payload.tokenUsed, tokensIn + tokensOut));
  const decision = String(payload.decision || 'blocked').toLowerCase();
  const blockedReason = typeof payload.blockedReason === 'string' && payload.blockedReason.trim()
    ? payload.blockedReason.trim()
    : null;
  const createdAtIso = toIso(payload.createdAt) || new Date().toISOString();
  const dailyDate = toDateKey(createdAtIso);

  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(lineUserId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists ? normalizeStats(lineUserId, snap.data()) : normalizeStats(lineUserId, {});
    const resetDaily = current.dailyDate !== dailyDate;
    const nextDailyUsage = (resetDaily ? 0 : current.dailyUsageCount) + 1;
    const nextDailyTokens = (resetDaily ? 0 : current.dailyTokenUsed) + tokenUsed;

    const nextBlockedHistory = Array.isArray(current.blockedHistory) ? current.blockedHistory.slice() : [];
    if (shouldCountAsBlocked(decision) && blockedReason) {
      nextBlockedHistory.unshift({ blockedReason, createdAt: createdAtIso });
    }

    const next = {
      lineUserId,
      usageCount: current.usageCount + 1,
      totalTokensIn: current.totalTokensIn + tokensIn,
      totalTokensOut: current.totalTokensOut + tokensOut,
      totalTokenUsed: current.totalTokenUsed + tokenUsed,
      blockedCount: current.blockedCount + (shouldCountAsBlocked(decision) ? 1 : 0),
      lastUsedAt: createdAtIso,
      dailyDate,
      dailyUsageCount: nextDailyUsage,
      dailyTokenUsed: nextDailyTokens,
      blockedHistory: nextBlockedHistory.slice(0, 10),
      updatedAt: payload.updatedAt || serverTimestamp()
    };

    tx.set(docRef, next, { merge: true });
    return normalizeStats(lineUserId, next);
  });
}

module.exports = {
  COLLECTION,
  getUserUsageStats,
  listUserUsageStatsByLineUserIds,
  incrementUserUsageStats
};
