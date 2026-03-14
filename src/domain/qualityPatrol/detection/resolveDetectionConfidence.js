'use strict';

const { DETECTION_CONFIDENCE } = require('./constants');

function resolveDetectionConfidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metricStatus = typeof payload.metricStatus === 'string' ? payload.metricStatus : 'unavailable';
  const sampleCount = Number.isFinite(Number(payload.sampleCount)) ? Number(payload.sampleCount) : 0;
  const value = Number.isFinite(Number(payload.value)) ? Number(payload.value) : 0;
  const blockerCount = Number.isFinite(Number(payload.blockedCount)) ? Number(payload.blockedCount) : 0;

  if (metricStatus === 'blocked') {
    return blockerCount >= 2 || sampleCount >= 3 ? DETECTION_CONFIDENCE.medium : DETECTION_CONFIDENCE.low;
  }
  if (metricStatus === 'unavailable') return sampleCount > 0 ? DETECTION_CONFIDENCE.medium : DETECTION_CONFIDENCE.low;
  if (metricStatus === 'warn') return sampleCount >= 3 ? DETECTION_CONFIDENCE.medium : DETECTION_CONFIDENCE.low;
  if (metricStatus === 'fail') {
    if (sampleCount >= 3 || value >= 0.75 || value <= 0.25) return DETECTION_CONFIDENCE.high;
    return DETECTION_CONFIDENCE.medium;
  }
  return DETECTION_CONFIDENCE.low;
}

module.exports = {
  resolveDetectionConfidence
};
