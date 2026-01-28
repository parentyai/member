'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
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

async function createNotificationPhase1(data) {
  const payload = data || {};
  const message = payload.message || {};

  requireField('scenario', payload.scenario);
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
    scenario: payload.scenario,
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
