'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'user_context_snapshots';

const ALLOWED_PHASES = new Set(['pre', 'arrival', 'settled', 'extend', 'return']);
const ALLOWED_PRIORITIES = new Set(['safety', 'speed', 'cost']);

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeText(value, fallback) {
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
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePriorityList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '').toLowerCase();
    if (!normalized) return;
    if (!ALLOWED_PRIORITIES.has(normalized)) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 3);
}

function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      key: normalizeText(item.key, ''),
      due: normalizeDate(item.due),
      status: normalizeText(item.status, 'open')
    }))
    .filter((item) => item.key)
    .slice(0, 5);
}

function normalizeRiskFlags(value, limit) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 3;
  value.forEach((item) => {
    const key = normalizeText(item, '').toLowerCase();
    if (!key) return;
    if (!out.includes(key)) out.push(key);
  });
  return out.slice(0, max);
}

function normalizeSnapshot(lineUserId, data) {
  const payload = data && typeof data === 'object' ? data : {};
  const phase = normalizeText(payload.phase, 'pre').toLowerCase();
  return {
    lineUserId: normalizeLineUserId(lineUserId),
    phase: ALLOWED_PHASES.has(phase) ? phase : 'pre',
    location: {
      city: normalizeText(payload && payload.location && payload.location.city, null),
      state: normalizeText(payload && payload.location && payload.location.state, null)
    },
    family: {
      spouse: normalizeBoolean(payload && payload.family && payload.family.spouse, false),
      kidsAges: Array.isArray(payload && payload.family && payload.family.kidsAges)
        ? payload.family.kidsAges.map((item) => normalizeNumber(item, null)).filter((item) => Number.isFinite(item))
        : []
    },
    priorities: normalizePriorityList(payload.priorities),
    openTasksTop5: normalizeTasks(payload.openTasksTop5),
    riskFlagsTop3: normalizeRiskFlags(payload.riskFlagsTop3, 3),
    lastSummary: normalizeText(payload.lastSummary, ''),
    topOpenTasks: normalizeTasks(payload.topOpenTasks),
    riskFlags: normalizeRiskFlags(payload.riskFlags, 5),
    shortSummary: normalizeText(payload.shortSummary, ''),
    snapshotVersion: Math.max(1, Math.floor(normalizeNumber(payload.snapshotVersion, 1))),
    sourceUpdatedAt: normalizeDate(payload.sourceUpdatedAt),
    updatedAt: payload.updatedAt || null
  };
}

async function getUserContextSnapshot(lineUserId) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeSnapshot(id, snap.data());
}

async function upsertUserContextSnapshot(lineUserId, patch) {
  const id = normalizeLineUserId(lineUserId);
  if (!id) throw new Error('lineUserId required');
  const normalized = normalizeSnapshot(id, patch);
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: patch && patch.updatedAt ? patch.updatedAt : serverTimestamp()
  }), { merge: true });
  return normalizeSnapshot(id, Object.assign({}, normalized, {
    updatedAt: patch && patch.updatedAt ? patch.updatedAt : normalized.updatedAt
  }));
}

module.exports = {
  COLLECTION,
  ALLOWED_PHASES,
  getUserContextSnapshot,
  upsertUserContextSnapshot
};
