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
  const notificationCategory = normalizeNotificationCategory(payload.notificationCategory);

  const record = {
    title: payload.title,
    body: payload.body,
    ctaText: payload.ctaText,
    linkRegistryId: payload.linkRegistryId,
    scenarioKey: payload.scenarioKey,
    stepKey: payload.stepKey,
    target: payload.target || null,
    notificationCategory,
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
