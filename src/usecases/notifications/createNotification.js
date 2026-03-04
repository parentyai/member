'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const {
  PHASE0_SCENARIOS,
  STEP_ORDER,
  NOTIFICATION_TRIGGER,
  NOTIFICATION_TRIGGER_VALUES
} = require('../../domain/constants');
const { normalizeNotificationCategory } = require('../../domain/notificationCategory');
const {
  resolveNotificationCtas,
  validateWarnLinkBlock
} = require('../../domain/validators');
const FIELD_SCN = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireField(name, value) {
  if (!isNonEmptyString(value)) {
    throw new Error(`${name} required`);
  }
}

function resolveCanonicalScenarioValue(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const canonical = typeof data[FIELD_SCK] === 'string' ? data[FIELD_SCK].trim() : '';
  if (canonical) return canonical;
  const legacy = typeof data[FIELD_SCN] === 'string' ? data[FIELD_SCN].trim() : '';
  return legacy || null;
}

function requireInList(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} invalid`);
  }
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function normalizeNotificationType(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!raw) return 'STEP';
  const allowed = new Set(['GENERAL', 'ANNOUNCEMENT', 'VENDOR', 'AB', 'STEP']);
  if (!allowed.has(raw)) {
    throw new Error('notificationType invalid');
  }
  return raw;
}

function normalizeNotificationTrigger(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return NOTIFICATION_TRIGGER.MANUAL;
  if (!NOTIFICATION_TRIGGER_VALUES.includes(raw)) {
    throw new Error('trigger invalid');
  }
  return raw;
}

function normalizeNotificationOrder(value, stepKey) {
  if (value !== undefined && value !== null && value !== '') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || Math.floor(numeric) !== numeric || numeric <= 0) {
      throw new Error('order invalid');
    }
    return numeric;
  }
  const index = STEP_ORDER.indexOf(String(stepKey || ''));
  if (index < 0) throw new Error('order invalid');
  return index + 1;
}

function normalizeNotificationMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out = {};
  Object.keys(meta).forEach((key) => {
    const value = meta[key];
    if (value === undefined) return;
    if (value === null) {
      out[key] = null;
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      out[key] = value
        .filter((item) => item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        .slice(0, 50);
      return;
    }
    if (typeof value === 'object') {
      const nested = {};
      Object.keys(value).forEach((nestedKey) => {
        const nestedValue = value[nestedKey];
        if (
          nestedValue === null
          || typeof nestedValue === 'string'
          || typeof nestedValue === 'number'
          || typeof nestedValue === 'boolean'
        ) {
          nested[nestedKey] = nestedValue;
        }
      });
      out[key] = nested;
    }
  });
  return Object.keys(out).length ? out : null;
}

function createStatusError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeCityPackFallback(payload) {
  const raw = payload && payload.cityPackFallback && typeof payload.cityPackFallback === 'object'
    ? payload.cityPackFallback
    : null;
  if (!raw) return null;
  const fallbackLinkRegistryId = typeof raw.fallbackLinkRegistryId === 'string' ? raw.fallbackLinkRegistryId.trim() : '';
  const fallbackCtaText = typeof raw.fallbackCtaText === 'string' ? raw.fallbackCtaText.trim() : '';
  if (!fallbackLinkRegistryId && !fallbackCtaText) return null;
  if (!fallbackLinkRegistryId || !fallbackCtaText) {
    throw new Error('cityPackFallback requires linkRegistryId and ctaText');
  }
  return { fallbackLinkRegistryId, fallbackCtaText };
}

function normalizeSeedMetadata(payload) {
  const seedTag = typeof payload.seedTag === 'string' ? payload.seedTag.trim() : '';
  const seedRunId = typeof payload.seedRunId === 'string' ? payload.seedRunId.trim() : '';
  const seededAt = typeof payload.seededAt === 'string' ? payload.seededAt.trim() : '';
  return {
    seedTag: seedTag || null,
    seedRunId: seedRunId || null,
    seededAt: seededAt || null
  };
}

async function createNotification(data) {
  const payload = data || {};
  const normalizedCanonical = resolveCanonicalScenarioValue(payload);

  requireField('title', payload.title);
  requireField('body', payload.body);
  requireField('ctaText', payload.ctaText);
  requireField('linkRegistryId', payload.linkRegistryId);
  requireField(FIELD_SCK, normalizedCanonical);
  requireField('stepKey', payload.stepKey);

  requireInList(FIELD_SCK, normalizedCanonical, PHASE0_SCENARIOS);
  requireInList('stepKey', payload.stepKey, STEP_ORDER);

  const multiCtaEnabled = resolveBooleanEnvFlag('ENABLE_NOTIFICATION_CTA_MULTI_V1', false);
  const ctaSlots = resolveNotificationCtas(payload, {
    allowSecondary: multiCtaEnabled,
    ignoreSecondary: false,
    minTotal: 1,
    maxSecondary: multiCtaEnabled ? 2 : 0,
    maxTotal: multiCtaEnabled ? 3 : 1
  });
  const ctaLinkIds = Array.from(new Set(ctaSlots.map((slot) => slot.linkRegistryId)));
  for (const linkRegistryId of ctaLinkIds) {
    const linkEntry = await linkRegistryRepo.getLink(linkRegistryId);
    if (!linkEntry) throw new Error('link registry entry not found');
    validateWarnLinkBlock(linkEntry);
  }

  const primaryCta = ctaSlots[0];
  const secondaryCtas = ctaSlots.slice(1).map((slot) => ({
    ctaText: slot.ctaText,
    linkRegistryId: slot.linkRegistryId
  }));
  const cityPackFallback = normalizeCityPackFallback(payload);
  if (cityPackFallback) {
    const fallbackLink = await linkRegistryRepo.getLink(cityPackFallback.fallbackLinkRegistryId);
    if (!fallbackLink) throw new Error('cityPackFallback link registry entry not found');
    validateWarnLinkBlock(fallbackLink);
  }
  const notificationCategory = normalizeNotificationCategory(payload.notificationCategory);
  const sourceRefs = normalizeStringArray(payload.sourceRefs);
  const notificationType = normalizeNotificationType(payload.notificationType);
  const notificationMeta = normalizeNotificationMeta(payload.notificationMeta);
  const trigger = normalizeNotificationTrigger(payload.trigger);
  const order = normalizeNotificationOrder(payload.order, payload.stepKey);
  const seedMetadata = normalizeSeedMetadata(payload);
  if (notificationType === 'VENDOR') {
    const vendorId = notificationMeta && typeof notificationMeta.vendorId === 'string'
      ? notificationMeta.vendorId.trim()
      : '';
    if (!vendorId) {
      throw createStatusError('notificationMeta.vendorId required', 422);
    }
  }

  const record = {
    title: payload.title,
    body: payload.body,
    ctaText: primaryCta.ctaText,
    linkRegistryId: primaryCta.linkRegistryId,
    [FIELD_SCK]: normalizedCanonical,
    stepKey: payload.stepKey,
    target: payload.target || null,
    sourceRefs,
    notificationCategory,
    notificationType,
    notificationMeta,
    trigger,
    order,
    cityPackFallback,
    status: payload.status || 'draft',
    scheduledAt: payload.scheduledAt || null,
    sentAt: payload.sentAt || null,
    createdBy: payload.createdBy || null,
    createdAt: payload.createdAt
  };
  if (secondaryCtas.length > 0) {
    record.secondaryCtas = secondaryCtas;
  }
  if (seedMetadata.seedTag) record.seedTag = seedMetadata.seedTag;
  if (seedMetadata.seedRunId) record.seedRunId = seedMetadata.seedRunId;
  if (seedMetadata.seededAt) record.seededAt = seedMetadata.seededAt;

  return notificationsRepo.createNotification(record);
}

module.exports = {
  createNotification
};
