'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { PHASE0_SCENARIOS, STEP_ORDER } = require('../../domain/constants');
const { normalizeNotificationCategory } = require('../../domain/notificationCategory');
const {
  validateSingleCta,
  validateLinkRequired,
  validateWarnLinkBlock
} = require('../../domain/validators');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireField(name, value) {
  if (!isNonEmptyString(value)) {
    throw new Error(`${name} required`);
  }
}

function requireInList(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} invalid`);
  }
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

async function createNotification(data) {
  const payload = data || {};

  requireField('title', payload.title);
  requireField('body', payload.body);
  requireField('ctaText', payload.ctaText);
  requireField('linkRegistryId', payload.linkRegistryId);
  requireField('scenarioKey', payload.scenarioKey);
  requireField('stepKey', payload.stepKey);

  requireInList('scenarioKey', payload.scenarioKey, PHASE0_SCENARIOS);
  requireInList('stepKey', payload.stepKey, STEP_ORDER);

  const linkEntry = await linkRegistryRepo.getLink(payload.linkRegistryId);
  if (!linkEntry) {
    throw new Error('link registry entry not found');
  }

  validateSingleCta(payload);
  validateLinkRequired(payload);
  validateWarnLinkBlock(linkEntry);
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

  const record = {
    title: payload.title,
    body: payload.body,
    ctaText: payload.ctaText,
    linkRegistryId: payload.linkRegistryId,
    scenarioKey: payload.scenarioKey,
    stepKey: payload.stepKey,
    target: payload.target || null,
    sourceRefs,
    notificationCategory,
    notificationType,
    notificationMeta,
    cityPackFallback,
    status: payload.status || 'draft',
    scheduledAt: payload.scheduledAt || null,
    sentAt: payload.sentAt || null,
    createdBy: payload.createdBy || null,
    createdAt: payload.createdAt
  };

  return notificationsRepo.createNotification(record);
}

module.exports = {
  createNotification
};
