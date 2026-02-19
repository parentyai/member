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
