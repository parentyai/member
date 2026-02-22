'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { isMissingIndexError, sortByTimestampDesc, toMillis } = require('./queryFallback');
const { recordMissingIndexFallback, shouldFailOnMissingIndex } = require('./indexFallbackPolicy');

const COLLECTION = 'city_packs';
const VALIDITY_DAYS = 120;
const ALLOWED_STATUS = new Set(['draft', 'active', 'retired']);
const ALLOWED_PACK_CLASS = new Set(['regional', 'nationwide']);
const ALLOWED_SLOT_STATUS = new Set(['active', 'inactive']);
const ALLOWED_TARGET_EFFECT = new Set(['include', 'exclude']);
const DEFAULT_LANGUAGE = 'ja';
const NATIONWIDE_POLICY_FEDERAL_ONLY = 'federal_only';
const FIXED_SLOT_KEYS = Object.freeze([
  'emergency',
  'admin',
  'utilities',
  'school',
  'transport',
  'health_entry',
  'helpdesk',
  'culture'
]);

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'draft';
}

function normalizePackClass(value) {
  const packClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_PACK_CLASS.has(packClass) ? packClass : 'regional';
}

function normalizeLanguage(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || DEFAULT_LANGUAGE;
}

function normalizeNationwidePolicy(packClass, _value) {
  if (packClass === 'nationwide') return NATIONWIDE_POLICY_FEDERAL_ONLY;
  return null;
}

function resolvePackClassFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return ALLOWED_PACK_CLASS.has(normalized) ? normalized : null;
}

function resolveLanguageFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeBasePackId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRules(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => value && typeof value === 'object').map((value) => Object.assign({}, value));
}

function normalizeSlotStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_SLOT_STATUS.has(status) ? status : 'active';
}

function normalizeTargetEffect(value) {
  const effect = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_TARGET_EFFECT.has(effect) ? effect : 'include';
}

function normalizeTargetValue(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number' || typeof item === 'boolean') return item;
        return null;
      })
      .filter((item) => item !== null && item !== '');
  }
  return null;
}

function normalizeTargetingRules(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  const rules = [];
  values.forEach((value) => {
    if (!value || typeof value !== 'object') return;
    const field = typeof value.field === 'string' ? value.field.trim() : '';
    const op = typeof value.op === 'string' ? value.op.trim().toLowerCase() : '';
    const targetValue = normalizeTargetValue(value.value);
    if (!field || !op) return;
    if (targetValue === null || (Array.isArray(targetValue) && targetValue.length === 0)) return;
    const effect = normalizeTargetEffect(value.effect);
    const normalized = { field, op, value: targetValue, effect };
    const signature = JSON.stringify(normalized);
    if (unique.has(signature)) return;
    unique.add(signature);
    rules.push(normalized);
  });
  return rules;
}

function normalizeSlots(values) {
  if (!Array.isArray(values)) return [];
  const usedSlotIds = new Set();
  const slots = [];
  values.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    const slotId = typeof value.slotId === 'string' ? value.slotId.trim() : '';
    if (!slotId || usedSlotIds.has(slotId)) return;
    usedSlotIds.add(slotId);
    const order = Number.isFinite(Number(value.order)) ? Math.max(Math.floor(Number(value.order)), 1) : (index + 1);
    const fallbackLinkRegistryId = typeof value.fallbackLinkRegistryId === 'string' && value.fallbackLinkRegistryId.trim()
      ? value.fallbackLinkRegistryId.trim()
      : null;
    const fallbackCtaText = typeof value.fallbackCtaText === 'string' && value.fallbackCtaText.trim()
      ? value.fallbackCtaText.trim()
      : null;
    const hasCompleteFallback = Boolean(fallbackLinkRegistryId && fallbackCtaText);
    slots.push({
      slotId,
      status: normalizeSlotStatus(value.status),
      templateRefId: typeof value.templateRefId === 'string' && value.templateRefId.trim() ? value.templateRefId.trim() : null,
      fallbackLinkRegistryId: hasCompleteFallback ? fallbackLinkRegistryId : null,
      fallbackCtaText: hasCompleteFallback ? fallbackCtaText : null,
      order
    });
  });
  return slots.sort((a, b) => a.order - b.order);
}

function normalizeAllowedIntents(value) {
  const list = normalizeStringArray(Array.isArray(value) ? value : ['CITY_PACK']);
  return list.length ? list : ['CITY_PACK'];
}

function normalizeOverrides(value) {
  const payload = value && typeof value === 'object' ? value : null;
  if (!payload) return null;
  const targetingRules = normalizeTargetingRules(payload.targetingRules);
  const slots = normalizeSlots(payload.slots);
  const sourceRefs = normalizeStringArray(payload.sourceRefs);
  const templateRefs = normalizeStringArray(payload.templateRefs);
  const rules = normalizeRules(payload.rules);
  const overridePayload = {
    targetingRules,
    slots,
    sourceRefs,
    templateRefs,
    rules
  };
  const hasAny = targetingRules.length || slots.length || sourceRefs.length || templateRefs.length || rules.length;
  return hasAny ? overridePayload : null;
}

function normalizeSlotContentItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const ctaText = typeof value.ctaText === 'string' ? value.ctaText.trim() : '';
  const linkRegistryId = typeof value.linkRegistryId === 'string' ? value.linkRegistryId.trim() : '';
  if (!description || !ctaText || !linkRegistryId) return null;
  const sourceRefs = normalizeStringArray(value.sourceRefs);
  return {
    description,
    ctaText,
    linkRegistryId,
    sourceRefs
  };
}

function normalizeSlotContents(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const output = {};
  FIXED_SLOT_KEYS.forEach((slotKey) => {
    const normalized = normalizeSlotContentItem(payload[slotKey]);
    if (normalized) output[slotKey] = normalized;
  });
  return output;
}

function normalizeSlotSchemaVersion(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim();
}

function resolveValidUntil(payload) {
  const validUntil = toDate(payload.validUntil);
  if (validUntil) return validUntil;
  const validFrom = toDate(payload.validFrom) || new Date();
  return addDays(validFrom, VALIDITY_DAYS);
}

function normalizePayload(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const basePackId = normalizeBasePackId(payload.basePackId);
  const overrides = normalizeOverrides(payload.overrides);
  const packClass = normalizePackClass(payload.packClass);
  const language = normalizeLanguage(payload.language);
  const nationwidePolicy = normalizeNationwidePolicy(packClass, payload.nationwidePolicy);
  return {
    id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : `cp_${crypto.randomUUID()}`,
    name,
    status: normalizeStatus(payload.status),
    sourceRefs: normalizeStringArray(payload.sourceRefs),
    templateRefs: normalizeStringArray(payload.templateRefs),
    validUntil: resolveValidUntil(payload),
    allowedIntents: normalizeAllowedIntents(payload.allowedIntents),
    rules: normalizeRules(payload.rules),
    targetingRules: normalizeTargetingRules(payload.targetingRules),
    slots: normalizeSlots(payload.slots),
    description: typeof payload.description === 'string' ? payload.description.trim() : '',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? Object.assign({}, payload.metadata) : {},
    requestId: normalizeString(payload.requestId),
    basePackId,
    overrides,
    slotContents: normalizeSlotContents(payload.slotContents),
    slotSchemaVersion: normalizeSlotSchemaVersion(payload.slotSchemaVersion),
    packClass,
    language,
    nationwidePolicy
  };
}

function normalizeCityPackStructurePatch(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const basePackId = normalizeBasePackId(payload.basePackId);
  const targetingRules = normalizeTargetingRules(payload.targetingRules);
  const slots = normalizeSlots(payload.slots);
  const overrides = basePackId ? normalizeOverrides({ targetingRules, slots }) : null;
  return {
    basePackId,
    overrides,
    targetingRules: basePackId ? [] : targetingRules,
    slots: basePackId ? [] : slots
  };
}


function validateBasePackDepth(basePack) {
  if (!basePack) return { ok: false, reason: 'base_pack_not_found' };
  if (basePack.basePackId) {
    return { ok: false, reason: 'base_pack_inheritance_not_allowed' };
  }
  return { ok: true };
}

async function createCityPack(data) {
  const payload = normalizePayload(data);
  if (!payload.name) throw new Error('name required');
  if (!payload.sourceRefs.length) throw new Error('sourceRefs required');
  const db = getDb();
  await db.collection(COLLECTION).doc(payload.id).set({
    name: payload.name,
    status: payload.status,
    sourceRefs: payload.sourceRefs,
    templateRefs: payload.templateRefs,
    validUntil: payload.validUntil,
    allowedIntents: payload.allowedIntents,
    rules: payload.rules,
    targetingRules: payload.targetingRules,
    slots: payload.slots,
    description: payload.description,
    metadata: payload.metadata,
    requestId: payload.requestId,
    basePackId: payload.basePackId,
    overrides: payload.overrides,
    slotContents: payload.slotContents,
    slotSchemaVersion: payload.slotSchemaVersion,
    packClass: payload.packClass,
    language: payload.language,
    nationwidePolicy: payload.nationwidePolicy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });
  return { id: payload.id };
}

async function getCityPack(cityPackId) {
  if (!cityPackId) throw new Error('cityPackId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(cityPackId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listCityPacks(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 200) : 50;
  let baseQuery = getDb().collection(COLLECTION);
  if (opts.status) baseQuery = baseQuery.where('status', '==', normalizeStatus(opts.status));
  const packClass = resolvePackClassFilter(opts.packClass);
  if (packClass) baseQuery = baseQuery.where('packClass', '==', packClass);
  const language = resolveLanguageFilter(opts.language);
  if (language) baseQuery = baseQuery.where('language', '==', language);
  let rows;
  try {
    const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(limit).get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    recordMissingIndexFallback({
      repo: 'cityPacksRepo',
      query: 'listCityPacks',
      err
    });
    if (shouldFailOnMissingIndex()) throw err;
    const snap = await baseQuery.get();
    rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
    sortByTimestampDesc(rows, 'updatedAt');
    rows = rows.slice(0, limit);
  }
  if (!opts.activeOnly) return rows;
  const now = Date.now();
  return rows.filter((row) => row.status === 'active' && toMillis(row.validUntil) > now);
}

async function updateCityPack(cityPackId, patch) {
  if (!cityPackId) throw new Error('cityPackId required');
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(cityPackId).set(payload, { merge: true });
  return { id: cityPackId };
}

module.exports = {
  VALIDITY_DAYS,
  FIXED_SLOT_KEYS,
  ALLOWED_PACK_CLASS,
  DEFAULT_LANGUAGE,
  NATIONWIDE_POLICY_FEDERAL_ONLY,
  normalizePackClass,
  normalizeLanguage,
  normalizeNationwidePolicy,
  createCityPack,
  getCityPack,
  listCityPacks,
  normalizeCityPackStructurePatch,
  normalizeBasePackId,
  normalizeOverrides,
  validateBasePackDepth,
  updateCityPack
};
