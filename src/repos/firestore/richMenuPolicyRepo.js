'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'opsConfig';
const DOC_ID = 'richMenuPolicy';

const DEFAULT_RICH_MENU_POLICY = Object.freeze({
  enabled: false,
  updateEnabled: true,
  defaultTemplateId: '',
  fallbackTemplateId: '',
  cooldownSeconds: 21600,
  maxAppliesPerMinute: 60,
  maxTargetsPerApply: 200,
  allowLegacyJourneyPolicyFallback: true
});

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  return value.trim();
}

function normalizeRichMenuPolicy(input) {
  if (input === null || input === undefined) {
    return Object.assign({}, DEFAULT_RICH_MENU_POLICY);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const enabled = normalizeBoolean(input.enabled, DEFAULT_RICH_MENU_POLICY.enabled);
  const updateEnabled = normalizeBoolean(input.updateEnabled, DEFAULT_RICH_MENU_POLICY.updateEnabled);
  const defaultTemplateId = normalizeString(input.defaultTemplateId, DEFAULT_RICH_MENU_POLICY.defaultTemplateId);
  const fallbackTemplateId = normalizeString(input.fallbackTemplateId, DEFAULT_RICH_MENU_POLICY.fallbackTemplateId);
  const cooldownSeconds = normalizeNumber(
    input.cooldownSeconds,
    DEFAULT_RICH_MENU_POLICY.cooldownSeconds,
    0,
    60 * 60 * 24 * 30
  );
  const maxAppliesPerMinute = normalizeNumber(
    input.maxAppliesPerMinute,
    DEFAULT_RICH_MENU_POLICY.maxAppliesPerMinute,
    1,
    5000
  );
  const maxTargetsPerApply = normalizeNumber(
    input.maxTargetsPerApply,
    DEFAULT_RICH_MENU_POLICY.maxTargetsPerApply,
    1,
    10000
  );
  const allowLegacyJourneyPolicyFallback = normalizeBoolean(
    input.allowLegacyJourneyPolicyFallback,
    DEFAULT_RICH_MENU_POLICY.allowLegacyJourneyPolicyFallback
  );

  if ([
    enabled,
    updateEnabled,
    defaultTemplateId,
    fallbackTemplateId,
    cooldownSeconds,
    maxAppliesPerMinute,
    maxTargetsPerApply,
    allowLegacyJourneyPolicyFallback
  ].includes(null)) {
    return null;
  }

  return {
    enabled,
    updateEnabled,
    defaultTemplateId,
    fallbackTemplateId,
    cooldownSeconds,
    maxAppliesPerMinute,
    maxTargetsPerApply,
    allowLegacyJourneyPolicyFallback
  };
}

async function getRichMenuPolicy() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return normalizeRichMenuPolicy(null);
  const data = snap.data() || {};
  const normalized = normalizeRichMenuPolicy(data);
  if (!normalized) return normalizeRichMenuPolicy(null);
  return Object.assign({}, normalized, {
    updatedAt: data.updatedAt || null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null
  });
}

async function setRichMenuPolicy(policy, actor) {
  const normalized = normalizeRichMenuPolicy(policy);
  if (!normalized) throw new Error('invalid richMenuPolicy');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getRichMenuPolicy();
}

module.exports = {
  COLLECTION,
  DOC_ID,
  DEFAULT_RICH_MENU_POLICY,
  normalizeRichMenuPolicy,
  getRichMenuPolicy,
  setRichMenuPolicy
};
