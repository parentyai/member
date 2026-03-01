'use strict';

const { getDb } = require('../../infra/firestore');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');

const COLLECTION = 'system_flags';
const DOC_ID = 'phase0';
const DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE = 'warn';
const DEFAULT_TRACK_AUDIT_WRITE_MODE = 'best_effort';
const ALLOWED_PUBLIC_WRITE_FAIL_CLOSE_MODES = new Set(['off', 'warn', 'enforce']);
const ALLOWED_TRACK_AUDIT_WRITE_MODES = new Set(['best_effort', 'await']);
const DEFAULT_LLM_POLICY = Object.freeze({
  lawfulBasis: 'unspecified',
  consentVerified: false,
  crossBorder: false
});
const latestPublicWriteModeByRoute = Object.create(null);
const latestTrackAuditModeByRoute = Object.create(null);

function normalizeServicePhase(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 1 || num > 4) return null;
  return num;
}

function normalizeNotificationPreset(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C') return upper;
  return null;
}

function normalizeDeliveryCountLegacyFallback(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeLlmEnabled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeLawfulBasis(value) {
  if (value === null || value === undefined) return DEFAULT_LLM_POLICY.lawfulBasis;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const allowed = new Set([
    'unspecified',
    'consent',
    'contract',
    'legal_obligation',
    'vital_interest',
    'public_task',
    'legitimate_interest'
  ]);
  if (!allowed.has(normalized)) return null;
  return normalized;
}

function normalizeBooleanWithDefault(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeLlmPolicy(value) {
  if (value === null || value === undefined) return Object.assign({}, DEFAULT_LLM_POLICY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const lawfulBasis = normalizeLawfulBasis(value.lawfulBasis);
  const consentVerified = normalizeBooleanWithDefault(value.consentVerified, DEFAULT_LLM_POLICY.consentVerified);
  const crossBorder = normalizeBooleanWithDefault(value.crossBorder, DEFAULT_LLM_POLICY.crossBorder);
  if (lawfulBasis === null || consentVerified === null || crossBorder === null) return null;
  return {
    lawfulBasis,
    consentVerified,
    crossBorder
  };
}

function normalizePublicWriteFailCloseMode(value, fallback) {
  const fallbackValue = fallback === null
    ? null
    : (typeof fallback === 'string' && ALLOWED_PUBLIC_WRITE_FAIL_CLOSE_MODES.has(fallback)
      ? fallback
      : DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE);
  if (value === null || value === undefined) return fallbackValue;
  if (typeof value !== 'string') return fallbackValue;
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_PUBLIC_WRITE_FAIL_CLOSE_MODES.has(normalized)) return fallbackValue;
  return normalized;
}

function normalizeTrackAuditWriteMode(value, fallback) {
  const fallbackValue = fallback === null
    ? null
    : (typeof fallback === 'string' && ALLOWED_TRACK_AUDIT_WRITE_MODES.has(fallback)
      ? fallback
      : DEFAULT_TRACK_AUDIT_WRITE_MODE);
  if (value === null || value === undefined) return fallbackValue;
  if (typeof value !== 'string') return fallbackValue;
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_TRACK_AUDIT_WRITE_MODES.has(normalized)) return fallbackValue;
  return normalized;
}

function normalizeModeMap(value, normalizeModeFn) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.keys(value).forEach((key) => {
    if (typeof key !== 'string') return;
    const normalizedKey = key.trim();
    if (!normalizedKey) return;
    out[normalizedKey] = normalizeModeFn(value[key], null);
  });
  return out;
}

function resolveModeByRoute(routeKey, routeMap, fallback) {
  const key = typeof routeKey === 'string' ? routeKey.trim() : '';
  if (key && routeMap && Object.prototype.hasOwnProperty.call(routeMap, key) && routeMap[key]) {
    return routeMap[key];
  }
  return fallback;
}

function parseModeFromJsonEnv(raw, normalizeModeFn) {
  if (typeof raw !== 'string') return {};
  const value = raw.trim();
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return normalizeModeMap(parsed, normalizeModeFn);
  } catch (_err) {
    return {};
  }
}

function resolvePublicWriteFailCloseModeFromData(data, routeKey) {
  const payload = data && typeof data === 'object' ? data : {};
  const envGlobal = normalizePublicWriteFailCloseMode(process.env.PUBLIC_WRITE_FAIL_CLOSE_MODE, null);
  const envByRoute = parseModeFromJsonEnv(process.env.PUBLIC_WRITE_FAIL_CLOSE_MODE_BY_ROUTE, normalizePublicWriteFailCloseMode);
  const modeByRoute = normalizeModeMap(payload.publicWriteFailCloseModeByRoute, normalizePublicWriteFailCloseMode);
  const baseMode = envGlobal || normalizePublicWriteFailCloseMode(payload.publicWriteFailCloseMode, DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE);
  const persistedResolved = resolveModeByRoute(routeKey, modeByRoute, baseMode);
  return resolveModeByRoute(routeKey, envByRoute, persistedResolved);
}

function resolveTrackAuditWriteModeFromData(data, routeKey) {
  const payload = data && typeof data === 'object' ? data : {};
  const envGlobal = normalizeTrackAuditWriteMode(process.env.TRACK_AUDIT_WRITE_MODE, null);
  const envByRoute = parseModeFromJsonEnv(process.env.TRACK_AUDIT_WRITE_MODE_BY_ROUTE, normalizeTrackAuditWriteMode);
  const modeByRoute = normalizeModeMap(payload.trackAuditWriteModeByRoute, normalizeTrackAuditWriteMode);
  const baseMode = envGlobal || normalizeTrackAuditWriteMode(payload.trackAuditWriteMode, DEFAULT_TRACK_AUDIT_WRITE_MODE);
  const persistedResolved = resolveModeByRoute(routeKey, modeByRoute, baseMode);
  return resolveModeByRoute(routeKey, envByRoute, persistedResolved);
}

async function getKillSwitch() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return Boolean(data.killSwitch);
}

async function getPublicWriteFailCloseMode(routeKey) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};
  return resolvePublicWriteFailCloseModeFromData(data, routeKey);
}

async function getTrackAuditWriteMode(routeKey) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};
  return resolveTrackAuditWriteModeFromData(data, routeKey);
}

function resolveLatestModeByRoute(cacheMap, routeKey, fallbackMode) {
  const key = typeof routeKey === 'string' ? routeKey.trim() : '';
  if (key && typeof cacheMap[key] === 'string' && cacheMap[key]) return cacheMap[key];
  if (typeof cacheMap.__default === 'string' && cacheMap.__default) return cacheMap.__default;
  return fallbackMode;
}

async function getPublicWriteSafetySnapshot(routeKey) {
  try {
    const db = getDb();
    const docRef = db.collection(COLLECTION).doc(DOC_ID);
    const snap = await docRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const killSwitchOn = Boolean(data.killSwitch);
    const failCloseMode = resolvePublicWriteFailCloseModeFromData(data, routeKey);
    const trackAuditWriteMode = resolveTrackAuditWriteModeFromData(data, routeKey);
    if (typeof routeKey === 'string' && routeKey.trim()) {
      latestPublicWriteModeByRoute[routeKey.trim()] = failCloseMode;
      latestTrackAuditModeByRoute[routeKey.trim()] = trackAuditWriteMode;
    }
    latestPublicWriteModeByRoute.__default = failCloseMode;
    latestTrackAuditModeByRoute.__default = trackAuditWriteMode;
    return {
      killSwitchOn,
      failCloseMode,
      trackAuditWriteMode,
      readError: false,
      source: 'live'
    };
  } catch (err) {
    const envFailCloseMode = normalizePublicWriteFailCloseMode(process.env.PUBLIC_WRITE_FAIL_CLOSE_MODE, null);
    const envTrackAuditWriteMode = normalizeTrackAuditWriteMode(process.env.TRACK_AUDIT_WRITE_MODE, null);
    const failCloseMode = resolveLatestModeByRoute(
      latestPublicWriteModeByRoute,
      routeKey,
      envFailCloseMode || DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE
    );
    const trackAuditWriteMode = resolveLatestModeByRoute(
      latestTrackAuditModeByRoute,
      routeKey,
      envTrackAuditWriteMode || DEFAULT_TRACK_AUDIT_WRITE_MODE
    );
    return {
      killSwitchOn: false,
      failCloseMode: envFailCloseMode || failCloseMode,
      trackAuditWriteMode: envTrackAuditWriteMode || trackAuditWriteMode,
      readError: true,
      readErrorCode: 'kill_switch_read_failed',
      readErrorMessage: err && err.message ? String(err.message) : 'kill switch read failed',
      source: 'fallback'
    };
  }
}

async function setKillSwitch(isOn) {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ killSwitch: Boolean(isOn) }, { merge: true });
  return { id: DOC_ID, killSwitch: Boolean(isOn) };
}

async function getServicePhase() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return normalizeServicePhase(data.servicePhase);
}

async function setServicePhase(servicePhase) {
  if (servicePhase === null) {
    const db = getDb();
    const docRef = db.collection(COLLECTION).doc(DOC_ID);
    await docRef.set({ servicePhase: null }, { merge: true });
    return { id: DOC_ID, servicePhase: null };
  }
  const normalized = normalizeServicePhase(servicePhase);
  if (normalized === null) throw new Error('invalid servicePhase');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ servicePhase: normalized }, { merge: true });
  return { id: DOC_ID, servicePhase: normalized };
}

async function getNotificationPreset() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return normalizeNotificationPreset(data.notificationPreset);
}

async function setNotificationPreset(notificationPreset) {
  if (notificationPreset === null) {
    const db = getDb();
    const docRef = db.collection(COLLECTION).doc(DOC_ID);
    await docRef.set({ notificationPreset: null }, { merge: true });
    return { id: DOC_ID, notificationPreset: null };
  }
  const normalized = normalizeNotificationPreset(notificationPreset);
  if (normalized === null) throw new Error('invalid notificationPreset');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ notificationPreset: normalized }, { merge: true });
  return { id: DOC_ID, notificationPreset: normalized };
}

async function getNotificationCaps() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return normalizeNotificationCaps(null);
  const data = snap.data() || {};
  return normalizeNotificationCaps(data.notificationCaps);
}

async function setNotificationCaps(notificationCaps) {
  const normalized = normalizeNotificationCaps(notificationCaps);
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ notificationCaps: normalized }, { merge: true });
  return { id: DOC_ID, notificationCaps: normalized };
}

async function getDeliveryCountLegacyFallback() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return true;
  const data = snap.data() || {};
  const normalized = normalizeDeliveryCountLegacyFallback(data.deliveryCountLegacyFallback);
  return normalized === null ? true : normalized;
}

async function setDeliveryCountLegacyFallback(deliveryCountLegacyFallback) {
  const normalized = normalizeDeliveryCountLegacyFallback(deliveryCountLegacyFallback);
  if (normalized === null) throw new Error('invalid deliveryCountLegacyFallback');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ deliveryCountLegacyFallback: normalized }, { merge: true });
  return { id: DOC_ID, deliveryCountLegacyFallback: normalized };
}

async function getLlmEnabled() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const normalized = normalizeLlmEnabled(data.llmEnabled);
  return normalized === null ? false : normalized;
}

async function setLlmEnabled(llmEnabled) {
  const normalized = normalizeLlmEnabled(llmEnabled);
  if (normalized === null) throw new Error('invalid llmEnabled');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ llmEnabled: normalized }, { merge: true });
  return { id: DOC_ID, llmEnabled: normalized };
}

async function getLlmPolicy() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return Object.assign({}, DEFAULT_LLM_POLICY);
  const data = snap.data() || {};
  const normalized = normalizeLlmPolicy(data.llmPolicy);
  return normalized === null ? Object.assign({}, DEFAULT_LLM_POLICY) : normalized;
}

async function setLlmPolicy(llmPolicy) {
  const normalized = normalizeLlmPolicy(llmPolicy);
  if (normalized === null) throw new Error('invalid llmPolicy');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  await docRef.set({ llmPolicy: normalized }, { merge: true });
  return { id: DOC_ID, llmPolicy: normalized };
}

module.exports = {
  DEFAULT_PUBLIC_WRITE_FAIL_CLOSE_MODE,
  DEFAULT_TRACK_AUDIT_WRITE_MODE,
  DEFAULT_LLM_POLICY,
  normalizeLlmPolicy,
  normalizePublicWriteFailCloseMode,
  normalizeTrackAuditWriteMode,
  getPublicWriteFailCloseMode,
  getTrackAuditWriteMode,
  getPublicWriteSafetySnapshot,
  getKillSwitch,
  setKillSwitch,
  getServicePhase,
  setServicePhase,
  getNotificationPreset,
  setNotificationPreset,
  getNotificationCaps,
  setNotificationCaps,
  getDeliveryCountLegacyFallback,
  setDeliveryCountLegacyFallback,
  getLlmEnabled,
  setLlmEnabled,
  getLlmPolicy,
  setLlmPolicy
};
