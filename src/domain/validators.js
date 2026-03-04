'use strict';

const { FAILURE_CODES } = require('./notificationFailureTaxonomy');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeDirectUrl(value) {
  const raw = normalizeString(value);
  return /^https?:\/\//i.test(raw);
}

function throwWithCode(message, failureCode) {
  const err = new Error(message);
  err.failureCode = failureCode;
  throw err;
}

function validateNoDirectUrlFields(notification) {
  if (isNonEmptyString(notification && notification.url) || isNonEmptyString(notification && notification.linkUrl)) {
    throwWithCode('direct URL is forbidden', FAILURE_CODES.DIRECT_URL_FORBIDDEN);
  }
  if (looksLikeDirectUrl(notification && notification.linkRegistryId)) {
    throwWithCode('direct URL is forbidden', FAILURE_CODES.DIRECT_URL_FORBIDDEN);
  }
  const secondary = Array.isArray(notification && notification.secondaryCtas) ? notification.secondaryCtas : [];
  for (const item of secondary) {
    const row = item && typeof item === 'object' ? item : {};
    if (isNonEmptyString(row.url) || isNonEmptyString(row.linkUrl) || looksLikeDirectUrl(row.linkRegistryId)) {
      throwWithCode('direct URL is forbidden', FAILURE_CODES.DIRECT_URL_FORBIDDEN);
    }
  }
}

function normalizeSecondaryCtas(notification) {
  if (!notification || typeof notification !== 'object') return [];
  if (!Array.isArray(notification.secondaryCtas)) return [];
  return notification.secondaryCtas;
}

function validateSingleCta(notification) {
  if (!notification || typeof notification !== 'object') {
    throwWithCode('notification required', FAILURE_CODES.INVALID_CTA);
  }
  if (Array.isArray(notification.ctas) && notification.ctas.length !== 1) {
    throwWithCode('CTA must be exactly 1', FAILURE_CODES.INVALID_CTA);
  }
  if (Array.isArray(notification.secondaryCtas) && notification.secondaryCtas.length > 0) {
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
  validateNoDirectUrlFields(notification);
  return true;
}

function normalizeCtaText(value, fieldLabel) {
  const text = normalizeString(value);
  if (!text) {
    throwWithCode(`${fieldLabel} required`, FAILURE_CODES.INVALID_CTA);
  }
  if (/[\r\n]/.test(text)) {
    throwWithCode('CTA label must be single line', FAILURE_CODES.INVALID_CTA);
  }
  if (text.length > 20) {
    throwWithCode('CTA label too long', FAILURE_CODES.INVALID_CTA);
  }
  return text;
}

function normalizeLinkRegistryId(value, fieldLabel) {
  const id = normalizeString(value);
  if (!id) {
    throwWithCode(`${fieldLabel} required`, FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  }
  if (looksLikeDirectUrl(id)) {
    throwWithCode('direct URL is forbidden', FAILURE_CODES.DIRECT_URL_FORBIDDEN);
  }
  return id;
}

function resolveNotificationCtas(notification, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const allowSecondary = opts.allowSecondary !== false;
  const ignoreSecondary = opts.ignoreSecondary === true;
  const minTotal = Number.isFinite(Number(opts.minTotal)) ? Math.max(1, Math.floor(Number(opts.minTotal))) : 1;
  const maxSecondary = Number.isFinite(Number(opts.maxSecondary)) ? Math.max(0, Math.floor(Number(opts.maxSecondary))) : 2;
  const maxTotal = Number.isFinite(Number(opts.maxTotal)) ? Math.max(1, Math.floor(Number(opts.maxTotal))) : 3;

  if (!notification || typeof notification !== 'object') {
    throwWithCode('notification required', FAILURE_CODES.INVALID_CTA);
  }
  validateNoDirectUrlFields(notification);
  const primary = {
    slot: 'primary',
    ctaText: normalizeCtaText(notification.ctaText, 'ctaText'),
    linkRegistryId: normalizeLinkRegistryId(notification.linkRegistryId, 'linkRegistryId')
  };
  const slots = [primary];

  const secondaryRaw = normalizeSecondaryCtas(notification);
  if (secondaryRaw.length > 0) {
    if (!allowSecondary) {
      if (!ignoreSecondary) {
        throwWithCode('CTA must be exactly 1', FAILURE_CODES.INVALID_CTA);
      }
    } else {
      if (secondaryRaw.length > maxSecondary) {
        throwWithCode(`secondary CTA must be <= ${maxSecondary}`, FAILURE_CODES.INVALID_CTA);
      }
      secondaryRaw.forEach((item, index) => {
        const row = item && typeof item === 'object' ? item : {};
        slots.push({
          slot: `secondary${index + 1}`,
          ctaText: normalizeCtaText(row.ctaText, `secondaryCtas[${index}].ctaText`),
          linkRegistryId: normalizeLinkRegistryId(row.linkRegistryId, `secondaryCtas[${index}].linkRegistryId`)
        });
      });
    }
  }

  if (slots.length < minTotal || slots.length > maxTotal) {
    throwWithCode(`CTA total must be between ${minTotal} and ${maxTotal}`, FAILURE_CODES.INVALID_CTA);
  }
  const dedupe = new Set();
  slots.forEach((slot) => {
    const key = slot.ctaText.toLowerCase();
    if (dedupe.has(key)) {
      throwWithCode('CTA labels must be unique', FAILURE_CODES.INVALID_CTA);
    }
    dedupe.add(key);
  });
  return slots;
}

function validateCtaStructure(notification, options) {
  resolveNotificationCtas(notification, options);
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
  validateCtaStructure,
  resolveNotificationCtas,
  validateWarnLinkBlock,
  validateKillSwitch,
  validateNotificationPayload
};
