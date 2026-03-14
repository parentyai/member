'use strict';

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveMetricStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sampleCount = Math.max(0, Math.floor(normalizeNumber(payload.sampleCount)));
  const blockedCount = Math.max(0, Math.floor(normalizeNumber(payload.blockedCount)));
  const unavailableCount = Math.max(0, Math.floor(normalizeNumber(payload.unavailableCount)));
  const missingCount = Math.max(0, Math.floor(normalizeNumber(payload.missingCount)));
  const value = Math.max(0, Math.min(1, normalizeNumber(payload.value)));
  const threshold = payload.threshold && typeof payload.threshold === 'object' ? payload.threshold : {};
  const direction = threshold.direction === 'lower' ? 'lower' : 'higher';

  if (sampleCount <= 0) {
    if (blockedCount > 0 && unavailableCount === 0 && missingCount === 0) return 'blocked';
    if (unavailableCount > 0 || missingCount > 0) return 'unavailable';
    if (blockedCount > 0) return 'blocked';
    return 'unavailable';
  }

  if (direction === 'lower') {
    if (value <= Number(threshold.passMax || 0)) return 'pass';
    if (value <= Number(threshold.warnMax || 0)) return 'warn';
    return 'fail';
  }

  if (value >= Number(threshold.passMin || 0)) return 'pass';
  if (value >= Number(threshold.warnMin || 0)) return 'warn';
  return 'fail';
}

module.exports = {
  resolveMetricStatus
};
