'use strict';

const crypto = require('crypto');
const { resolveNotificationCtas } = require('./validators');

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hashLabel(value) {
  const text = normalizeString(value);
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function fallbackPrimary(notification) {
  const ctaText = normalizeString(notification && notification.ctaText);
  const linkRegistryId = normalizeString(notification && notification.linkRegistryId);
  if (!ctaText || !linkRegistryId) return [];
  return [{
    slot: 'primary',
    ctaText,
    linkRegistryId
  }];
}

function resolveNotificationCtaAuditSummary(notification, options) {
  const payload = notification && typeof notification === 'object' ? notification : {};
  const opts = options && typeof options === 'object' ? options : {};
  const allowSecondary = opts.allowSecondary !== false;
  const ignoreSecondary = opts.ignoreSecondary === true;
  let ctas = [];
  try {
    ctas = resolveNotificationCtas(payload, {
      allowSecondary,
      ignoreSecondary,
      minTotal: 1,
      maxSecondary: allowSecondary ? 2 : 0,
      maxTotal: allowSecondary ? 3 : 1
    });
  } catch (_err) {
    ctas = fallbackPrimary(payload);
  }
  return {
    ctaCount: ctas.length,
    ctaLinkRegistryIds: ctas.map((item) => item.linkRegistryId),
    ctaLabelHashes: ctas.map((item) => hashLabel(item.ctaText)).filter(Boolean),
    ctaLabelLengths: ctas.map((item) => normalizeString(item.ctaText).length)
  };
}

module.exports = {
  resolveNotificationCtaAuditSummary
};
