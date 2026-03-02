'use strict';

const { emitObs } = require('./obs');

function toSafeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Number(fallback || 0);
  if (num < 0) return 0;
  return Math.floor(num);
}

function toSafeText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text) return text;
  return fallback || null;
}

function logReadPathLoadMetric(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const meta = {
    cluster: toSafeText(input.cluster, 'unknown_cluster'),
    operation: toSafeText(input.operation, 'unknown_operation'),
    scannedCount: toSafeNumber(input.scannedCount, 0),
    resultCount: toSafeNumber(input.resultCount, 0),
    durationMs: toSafeNumber(input.durationMs, 0),
    fallbackUsed: input.fallbackUsed === true,
    dataSource: toSafeText(input.dataSource, null)
  };

  if (Number.isFinite(Number(input.limit))) meta.limit = toSafeNumber(input.limit, 0);
  if (Number.isFinite(Number(input.readLimitUsed))) meta.readLimitUsed = toSafeNumber(input.readLimitUsed, 0);
  if (toSafeText(input.traceId, null)) meta.traceId = toSafeText(input.traceId, null);

  return emitObs({
    action: 'read_path_load',
    result: toSafeText(input.result, 'ok'),
    requestId: toSafeText(input.requestId, null) || undefined,
    meta
  });
}

module.exports = {
  logReadPathLoadMetric
};
