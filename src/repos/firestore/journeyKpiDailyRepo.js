'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_kpi_daily';

function normalizeDateKey(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return '';
  return text;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, Math.round(num * 10000) / 10000));
}

function normalizeRetention(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  return {
    d7: normalizeRate(payload.d7),
    d30: normalizeRate(payload.d30),
    d60: normalizeRate(payload.d60),
    d90: normalizeRate(payload.d90)
  };
}

function normalizeChurnReasons(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  return {
    blocked: normalizeRate(payload.blocked),
    value_gap: normalizeRate(payload.value_gap),
    cost: normalizeRate(payload.cost),
    status_change: normalizeRate(payload.status_change)
  };
}

function normalizeDailyKpi(dateKey, data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    dateKey: normalizeDateKey(dateKey),
    generatedAt: toIso(payload.generatedAt) || new Date().toISOString(),
    lookbackDays: Math.max(7, Math.min(365, Math.floor(normalizeNumber(payload.lookbackDays, 120)))),
    scanLimit: Math.max(100, Math.min(10000, Math.floor(normalizeNumber(payload.scanLimit, 4000)))),
    totalUsers: Math.max(0, Math.floor(normalizeNumber(payload.totalUsers, 0))),
    proActiveCount: Math.max(0, Math.floor(normalizeNumber(payload.proActiveCount, 0))),
    proActiveRatio: normalizeRate(payload.proActiveRatio),
    retention: normalizeRetention(payload.retention),
    phaseCompletionRate: normalizeRate(payload.phaseCompletionRate),
    nextActionExecutionRate: normalizeRate(payload.nextActionExecutionRate),
    proConversionRate: normalizeRate(payload.proConversionRate),
    churnReasonRatio: normalizeChurnReasons(payload.churnReasonRatio),
    nextActionShownCount: Math.max(0, Math.floor(normalizeNumber(payload.nextActionShownCount, 0))),
    nextActionCompletedCount: Math.max(0, Math.floor(normalizeNumber(payload.nextActionCompletedCount, 0))),
    proPromptedCount: Math.max(0, Math.floor(normalizeNumber(payload.proPromptedCount, 0))),
    proConvertedCount: Math.max(0, Math.floor(normalizeNumber(payload.proConvertedCount, 0))),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    updatedAt: payload.updatedAt || null,
    updatedBy: typeof payload.updatedBy === 'string' && payload.updatedBy.trim() ? payload.updatedBy.trim() : null
  };
}

async function upsertJourneyKpiDaily(dateKey, data, actor) {
  const key = normalizeDateKey(dateKey);
  if (!key) throw new Error('dateKey required');
  const normalized = normalizeDailyKpi(key, data);
  const db = getDb();
  await db.collection(COLLECTION).doc(key).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy: typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown'
  }), { merge: true });
  return getJourneyKpiDaily(key);
}

async function getJourneyKpiDaily(dateKey) {
  const key = normalizeDateKey(dateKey);
  if (!key) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(key).get();
  if (!snap.exists) return null;
  return normalizeDailyKpi(key, snap.data());
}

async function getLatestJourneyKpiDaily() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('dateKey', 'desc').limit(1).get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return normalizeDailyKpi(doc.id, doc.data());
}

async function listJourneyKpiDaily(limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 90) : 30;
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('dateKey', 'desc').limit(cap).get();
  return snap.docs.map((doc) => normalizeDailyKpi(doc.id, doc.data()));
}

module.exports = {
  COLLECTION,
  normalizeDateKey,
  normalizeDailyKpi,
  upsertJourneyKpiDaily,
  getJourneyKpiDaily,
  getLatestJourneyKpiDaily,
  listJourneyKpiDaily
};
