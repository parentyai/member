'use strict';

const { FAILURE_CODES } = require('./notificationFailureTaxonomy');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function throwWithCode(message, failureCode) {
  const err = new Error(message);
  err.failureCode = failureCode;
  throw err;
}

function validateSingleCta(notification) {
  if (!notification || typeof notification !== 'object') {
    throwWithCode('notification required', FAILURE_CODES.INVALID_CTA);
  }
  if (Array.isArray(notification.ctas) && notification.ctas.length !== 1) {
    throwWithCode('CTA must be exactly 1', FAILURE_CODES.INVALID_CTA);
  }
  if (!isNonEmptyString(notification.ctaText)) {
    throwWithCode('CTA text required', FAILURE_CODES.INVALID_CTA);
  }
  return true;
}

function validateLinkRequired(notification) {
  if (!notification || typeof notification !== 'object') {
    throwWithCode('notification required', FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  }
  if (!isNonEmptyString(notification.linkRegistryId)) {
    throwWithCode('linkRegistryId required', FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  }
  if (isNonEmptyString(notification.url) || isNonEmptyString(notification.linkUrl)) {
    throwWithCode('direct URL is forbidden', FAILURE_CODES.DIRECT_URL_FORBIDDEN);
  }
  return true;
}

function validateWarnLinkBlock(linkRegistryEntry) {
  if (!linkRegistryEntry || typeof linkRegistryEntry !== 'object') {
    throwWithCode('link registry entry required', FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  }
  const state = linkRegistryEntry.lastHealth && linkRegistryEntry.lastHealth.state;
  if (state === 'WARN') {
    throwWithCode('link health WARN', FAILURE_CODES.GUARD_BLOCK_WARN_LINK);
  }
  return true;
}

function validateKillSwitch(killSwitchState) {
  const isOn = typeof killSwitchState === 'boolean'
    ? killSwitchState
    : Boolean(killSwitchState && killSwitchState.killSwitch);
  if (isOn) {
    throwWithCode('kill switch is ON', FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH);
  }
  return true;
}

function validateNotificationPayload(notification, linkRegistryEntry, killSwitchState) {
  validateKillSwitch(killSwitchState);
  validateSingleCta(notification);
  validateLinkRequired(notification);
  validateWarnLinkBlock(linkRegistryEntry);
  return true;
}

module.exports = {
  validateSingleCta,
  validateLinkRequired,
  validateWarnLinkBlock,
  validateKillSwitch,
  validateNotificationPayload
};
