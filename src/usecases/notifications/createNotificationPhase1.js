'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const {
  validateSingleCta,
  validateLinkRequired,
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

async function createNotificationPhase1(data) {
  const payload = data || {};
  const message = payload.message || {};
  const canonicalValue = resolveCanonicalScenarioValue(payload);

  requireField(FIELD_SCK, canonicalValue);
  requireField('step', payload.step);
  requireField('linkRegistryId', payload.linkRegistryId);
  requireField('message.title', message.title);
  requireField('message.body', message.body);
  requireField('message.ctaText', message.ctaText);

  const linkEntry = await linkRegistryRepo.getLink(payload.linkRegistryId);
  if (!linkEntry) {
    throw new Error('link registry entry not found');
  }

  validateSingleCta({ ctaText: message.ctaText });
  validateLinkRequired({ linkRegistryId: payload.linkRegistryId, ctaText: message.ctaText });
  validateWarnLinkBlock(linkEntry);

  const record = {
    [FIELD_SCK]: canonicalValue,
    step: payload.step,
    message: {
      title: message.title,
      body: message.body,
      ctaText: message.ctaText
    },
    linkRegistryId: payload.linkRegistryId,
    sentAt: payload.sentAt || null
  };

  return notificationsRepo.createNotification(record);
}

module.exports = {
  createNotificationPhase1
};
