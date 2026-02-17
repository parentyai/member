'use strict';

const { getDb } = require('../../infra/firestore');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');

const COLLECTION = 'system_flags';
const DOC_ID = 'phase0';
const DEFAULT_LLM_POLICY = Object.freeze({
  lawfulBasis: 'unspecified',
  consentVerified: false,
  crossBorder: false
});

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

async function getKillSwitch() {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return Boolean(data.killSwitch);
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
  DEFAULT_LLM_POLICY,
  normalizeLlmPolicy,
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
