'use strict';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateSingleCta(notification) {
  if (!notification || typeof notification !== 'object') {
    throw new Error('notification required');
  }
  if (Array.isArray(notification.ctas) && notification.ctas.length !== 1) {
    throw new Error('CTA must be exactly 1');
  }
  if (!isNonEmptyString(notification.ctaText)) {
    throw new Error('CTA text required');
  }
  return true;
}

function validateLinkRequired(notification) {
  if (!notification || typeof notification !== 'object') {
    throw new Error('notification required');
  }
  if (!isNonEmptyString(notification.linkRegistryId)) {
    throw new Error('linkRegistryId required');
  }
  if (isNonEmptyString(notification.url) || isNonEmptyString(notification.linkUrl)) {
    throw new Error('direct URL is forbidden');
  }
  return true;
}

function validateWarnLinkBlock(linkRegistryEntry) {
  if (!linkRegistryEntry || typeof linkRegistryEntry !== 'object') {
    throw new Error('link registry entry required');
  }
  const state = linkRegistryEntry.lastHealth && linkRegistryEntry.lastHealth.state;
  if (state === 'WARN') {
    throw new Error('link health WARN');
  }
  return true;
}

function validateKillSwitch(killSwitchState) {
  const isOn = typeof killSwitchState === 'boolean'
    ? killSwitchState
    : Boolean(killSwitchState && killSwitchState.killSwitch);
  if (isOn) {
    throw new Error('kill switch is ON');
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
