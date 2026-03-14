'use strict';

const { DETECTION_STATUS } = require('./constants');

function resolveDetectionStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const metricStatus = typeof payload.metricStatus === 'string' ? payload.metricStatus : 'unavailable';
  const missingCount = Number.isFinite(Number(payload.missingCount)) ? Number(payload.missingCount) : 0;

  if (metricStatus === 'blocked' || metricStatus === 'unavailable') return DETECTION_STATUS.blocked;
  if (missingCount > 0) return DETECTION_STATUS.watching;
  if (metricStatus === 'warn') return DETECTION_STATUS.watching;
  if (metricStatus === 'fail') return DETECTION_STATUS.open;
  return DETECTION_STATUS.resolved;
}

module.exports = {
  resolveDetectionStatus
};
