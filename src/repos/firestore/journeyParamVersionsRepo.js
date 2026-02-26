'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'journey_param_versions';
const ALLOWED_STATE = Object.freeze([
  'draft',
  'validated',
  'dry_run_passed',
  'applied',
  'rolled_back',
  'rejected'
]);

const STATE_TRANSITIONS = Object.freeze({
  draft: ['validated', 'rejected'],
  validated: ['dry_run_passed', 'rejected'],
  dry_run_passed: ['applied', 'rejected'],
  applied: ['rolled_back'],
  rolled_back: [],
  rejected: []
});

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeIso(value) {
  if (value === null || value === undefined || value === '') return null;
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

function cloneObject(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.parse(JSON.stringify(base));
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(value, fallback) {
  const normalized = normalizeText(value, fallback || 'draft');
  if (!normalized) return 'draft';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_STATE.includes(lowered)) return null;
  return lowered;
}

function normalizeStringList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  if (Number.isFinite(Number(maxItems)) && maxItems > 0) return out.slice(0, Math.floor(maxItems));
  return out;
}

function normalizeValidation(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const errors = normalizeStringList(payload.errors, 200);
  const warnings = normalizeStringList(payload.warnings, 200);
  const cycleCount = Number.isFinite(Number(payload.cycleCount)) ? Math.max(0, Math.floor(Number(payload.cycleCount))) : 0;
  return {
    ok: payload.ok === true,
    errors,
    warnings,
    cycleCount,
    validatedAt: normalizeIso(payload.validatedAt)
  };
}

function normalizeDryRun(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const metrics = payload.metrics && typeof payload.metrics === 'object' && !Array.isArray(payload.metrics)
    ? JSON.parse(JSON.stringify(payload.metrics))
    : {};
  const scope = payload.scope && typeof payload.scope === 'object' && !Array.isArray(payload.scope)
    ? JSON.parse(JSON.stringify(payload.scope))
    : {};
  return {
    metrics,
    scope,
    generatedAt: normalizeIso(payload.generatedAt),
    hash: normalizeText(payload.hash, null),
    ok: payload.ok === true
  };
}

function normalizeAppliedMeta(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    actor: normalizeText(payload.actor, null),
    traceId: normalizeText(payload.traceId, null),
    requestId: normalizeText(payload.requestId, null),
    appliedAt: normalizeIso(payload.appliedAt),
    rollbackAt: normalizeIso(payload.rollbackAt)
  };
}

function normalizeParameters(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    graph: cloneObject(payload.graph, {}),
    journeyPolicy: cloneObject(payload.journeyPolicy, {}),
    llmPolicyPatch: cloneObject(payload.llmPolicyPatch, {})
  };
}

function normalizeVersionId(value, fallback) {
  const normalized = normalizeText(value, fallback || '');
  if (!normalized) return '';
  if (!/^[A-Za-z0-9_\-:.]{3,128}$/.test(normalized)) return null;
  return normalized;
}

function normalizeJourneyParamVersion(value, fallbackVersionId) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const versionId = normalizeVersionId(payload.versionId, fallbackVersionId || '');
  if (!versionId) return null;
  const state = normalizeState(payload.state, 'draft');
  if (!state) return null;
  return {
    versionId,
    state,
    schemaVersion: Number.isFinite(Number(payload.schemaVersion)) ? Math.max(1, Math.floor(Number(payload.schemaVersion))) : 1,
    effectiveAt: normalizeIso(payload.effectiveAt),
    previousAppliedVersionId: normalizeVersionId(payload.previousAppliedVersionId, null),
    parameters: normalizeParameters(payload.parameters),
    validation: normalizeValidation(payload.validation),
    dryRun: normalizeDryRun(payload.dryRun),
    appliedMeta: normalizeAppliedMeta(payload.appliedMeta),
    note: normalizeText(payload.note, null),
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    createdBy: normalizeText(payload.createdBy, null),
    updatedBy: normalizeText(payload.updatedBy, null)
  };
}

function buildVersionId() {
  return `jpv_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function canTransitionState(currentState, nextState) {
  const current = normalizeState(currentState, 'draft');
  const next = normalizeState(nextState, 'draft');
  if (!current || !next) return false;
  if (current === next) return true;
  const allowed = STATE_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

async function getJourneyParamVersion(versionId) {
  const id = normalizeVersionId(versionId, '');
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeJourneyParamVersion(snap.data(), id);
}

async function createJourneyParamVersion(payload, actor) {
  const id = buildVersionId();
  const createdBy = normalizeText(actor, 'unknown') || 'unknown';
  const normalized = normalizeJourneyParamVersion(Object.assign({}, payload, {
    versionId: id,
    state: payload && payload.state ? payload.state : 'draft',
    createdBy,
    updatedBy: createdBy
  }), id);
  if (!normalized) throw new Error('invalid journeyParamVersion');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }), { merge: true });
  return getJourneyParamVersion(id);
}

async function setJourneyParamVersion(versionId, payload, actor) {
  const id = normalizeVersionId(versionId, '');
  if (!id) throw new Error('versionId required');
  const updatedBy = normalizeText(actor, 'unknown') || 'unknown';
  const normalized = normalizeJourneyParamVersion(Object.assign({}, payload, {
    versionId: id,
    updatedBy
  }), id);
  if (!normalized) throw new Error('invalid journeyParamVersion');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    createdAt: normalized.createdAt || serverTimestamp()
  }), { merge: true });
  return getJourneyParamVersion(id);
}

async function patchJourneyParamVersion(versionId, patch, actor, options) {
  const id = normalizeVersionId(versionId, '');
  if (!id) throw new Error('versionId required');
  const current = await getJourneyParamVersion(id);
  if (!current) throw new Error('journey_param_version_not_found');
  const payload = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const nextState = payload.state === undefined ? current.state : normalizeState(payload.state, current.state);
  if (!nextState) throw new Error('invalid_state');
  const opts = options && typeof options === 'object' ? options : {};
  if (opts.skipStateTransitionCheck !== true && !canTransitionState(current.state, nextState)) {
    throw new Error('invalid_state_transition');
  }
  const updatedBy = normalizeText(actor, 'unknown') || 'unknown';
  const merged = normalizeJourneyParamVersion(Object.assign({}, current, payload, {
    versionId: id,
    state: nextState,
    updatedBy,
    createdBy: current.createdBy || updatedBy
  }), id);
  if (!merged) throw new Error('invalid journeyParamVersion');
  const db = getDb();
  await db.collection(COLLECTION).doc(id).set(Object.assign({}, merged, {
    updatedAt: serverTimestamp(),
    createdAt: current.createdAt || serverTimestamp()
  }), { merge: true });
  return getJourneyParamVersion(id);
}

async function listJourneyParamVersions(limit) {
  const cap = Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Math.floor(Number(limit))), 100) : 20;
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs
    .map((doc) => normalizeJourneyParamVersion(doc.data(), doc.id))
    .filter(Boolean);
}

async function getLatestJourneyParamVersionByState(state) {
  const normalizedState = normalizeState(state, null);
  if (!normalizedState) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION)
    .where('state', '==', normalizedState)
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (!snap.docs.length) return null;
  const doc = snap.docs[0];
  return normalizeJourneyParamVersion(doc.data(), doc.id);
}

module.exports = {
  COLLECTION,
  ALLOWED_STATE,
  STATE_TRANSITIONS,
  normalizeJourneyParamVersion,
  canTransitionState,
  buildVersionId,
  createJourneyParamVersion,
  getJourneyParamVersion,
  setJourneyParamVersion,
  patchJourneyParamVersion,
  listJourneyParamVersions,
  getLatestJourneyParamVersionByState
};
