'use strict';

const SEVERITY_ORDER = {
  INFO: 0,
  WARN: 1,
  BLOCK: 2
};

const MISSING_SEVERITY = {
  missing_link_registry: 'BLOCK',
  invalid_cta_text: 'BLOCK',
  missing_deliveries: 'WARN',
  event_without_delivery: 'BLOCK',
  tracking_disabled_or_missing: 'WARN'
};

function maxSeverity(current, next) {
  if (SEVERITY_ORDER[next] > SEVERITY_ORDER[current]) return next;
  return current;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function evaluateNotificationSummaryCompleteness(summary) {
  const item = summary || {};
  const missing = [];

  if (!isNonEmptyString(item.linkRegistryId)) {
    missing.push('missing_link_registry');
  }

  if (!isNonEmptyString(item.ctaText)) {
    missing.push('invalid_cta_text');
  }

  const deliveredCount = typeof item.deliveredCount === 'number' ? item.deliveredCount : 0;
  const readCount = typeof item.readCount === 'number' ? item.readCount : 0;
  const clickCount = typeof item.clickCount === 'number' ? item.clickCount : 0;

  if (deliveredCount === 0) {
    missing.push('missing_deliveries');
    if (readCount > 0 || clickCount > 0) {
      missing.push('event_without_delivery');
    }
  }

  if (item.trackingEnabled === false) {
    missing.push('tracking_disabled_or_missing');
  }

  let severity = 'INFO';
  let hasBlock = false;
  missing.forEach((code) => {
    const next = MISSING_SEVERITY[code] || 'WARN';
    severity = maxSeverity(severity, next);
    if (next === 'BLOCK') hasBlock = true;
  });

  const ok = !hasBlock;
  const needsAttention = missing.length > 0;

  return {
    ok,
    missing,
    needsAttention,
    severity
  };
}

module.exports = {
  evaluateNotificationSummaryCompleteness
};
