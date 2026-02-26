'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'opsConfig';
const DOC_ID = 'journeyParamRuntime';

const DEFAULT_RUNTIME = Object.freeze({
  enabled: false,
  schemaVersion: 1,
  activeVersionId: null,
  previousAppliedVersionId: null,
  canary: Object.freeze({
    enabled: false,
    versionId: null,
    lineUserIds: []
  })
});

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_RUNTIME));
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeVersionId(value, fallback) {
  const normalized = normalizeText(value, fallback || null);
  if (normalized === null) return null;
  if (!normalized) return null;
  if (!/^[A-Za-z0-9_\-:.]{3,128}$/.test(normalized)) return null;
  return normalized;
}

function normalizeLineUserIds(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 500);
}

function normalizeCanary(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : cloneDefault().canary;
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const enabled = normalizeBoolean(raw.enabled, base.enabled);
  const versionId = normalizeVersionId(raw.versionId, base.versionId);
  const lineUserIds = normalizeLineUserIds(raw.lineUserIds === undefined ? base.lineUserIds : raw.lineUserIds);
  if (enabled === null || (raw.versionId !== undefined && raw.versionId !== null && versionId === null)) return null;
  return {
    enabled,
    versionId,
    lineUserIds,
    updatedAt: raw.updatedAt || null,
    updatedBy: normalizeText(raw.updatedBy, null)
  };
}

function normalizeJourneyParamRuntime(value) {
  const defaults = cloneDefault();
  if (value === null || value === undefined) return defaults;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const enabled = normalizeBoolean(value.enabled, defaults.enabled);
  const schemaVersion = Number.isFinite(Number(value.schemaVersion))
    ? Math.max(1, Math.floor(Number(value.schemaVersion)))
    : defaults.schemaVersion;
  const activeVersionId = normalizeVersionId(value.activeVersionId, defaults.activeVersionId);
  const previousAppliedVersionId = normalizeVersionId(value.previousAppliedVersionId, defaults.previousAppliedVersionId);
  const canary = normalizeCanary(value.canary, defaults.canary);
  if (enabled === null || canary === null) return null;
  return {
    enabled,
    schemaVersion,
    activeVersionId,
    previousAppliedVersionId,
    canary,
    updatedAt: value.updatedAt || null,
    updatedBy: normalizeText(value.updatedBy, null)
  };
}

async function getJourneyParamRuntime() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return cloneDefault();
  const normalized = normalizeJourneyParamRuntime(snap.data() || {});
  return normalized || cloneDefault();
}

async function setJourneyParamRuntime(runtime, actor) {
  const normalized = normalizeJourneyParamRuntime(runtime);
  if (!normalized) throw new Error('invalid journeyParamRuntime');
  const updatedBy = normalizeText(actor, 'unknown') || 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getJourneyParamRuntime();
}

async function patchJourneyParamRuntime(patch, actor) {
  const current = await getJourneyParamRuntime();
  const payload = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const merged = normalizeJourneyParamRuntime(Object.assign({}, current, payload, {
    canary: Object.assign({}, current.canary || {}, payload.canary || {})
  }));
  if (!merged) throw new Error('invalid journeyParamRuntime');
  return setJourneyParamRuntime(merged, actor);
}

module.exports = {
  COLLECTION,
  DOC_ID,
  DEFAULT_RUNTIME,
  normalizeJourneyParamRuntime,
  getJourneyParamRuntime,
  setJourneyParamRuntime,
  patchJourneyParamRuntime
};
