'use strict';

const {
  isUxosFatigueWarnEnabled,
  getUxosFatigueWarnMinRecipients,
  getUxosFatigueWarnBlockedRateThreshold
} = require('../../domain/uxos/featureFlags');

function toSafeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function evaluateFatigueWarning(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (!isUxosFatigueWarnEnabled()) {
    return {
      enabled: false,
      warn: false,
      warnings: [],
      metrics: {
        recipientCount: toSafeCount(payload.recipientCount),
        capBlockedCount: toSafeCount(payload.capBlockedCount),
        capBlockedRate: 0
      }
    };
  }

  const recipientCount = toSafeCount(payload.recipientCount || payload.count);
  const capBlockedCount = toSafeCount(payload.capBlockedCount);
  const capBlockedRate = recipientCount > 0
    ? Number((capBlockedCount / recipientCount).toFixed(4))
    : 0;
  const threshold = getUxosFatigueWarnBlockedRateThreshold();
  const minRecipients = getUxosFatigueWarnMinRecipients();
  const warnings = [];

  if (recipientCount >= minRecipients && capBlockedRate >= threshold) {
    warnings.push({
      code: 'high_blocked_rate',
      level: 'warn',
      message: 'cap blocked rate exceeds threshold',
      threshold,
      value: capBlockedRate
    });
  }

  if (recipientCount > 0 && capBlockedCount >= minRecipients) {
    warnings.push({
      code: 'high_blocked_count',
      level: 'warn',
      message: 'cap blocked count exceeds threshold',
      threshold: minRecipients,
      value: capBlockedCount
    });
  }

  return {
    enabled: true,
    warn: warnings.length > 0,
    warnings,
    metrics: {
      recipientCount,
      capBlockedCount,
      capBlockedRate
    }
  };
}

module.exports = {
  evaluateFatigueWarning
};
