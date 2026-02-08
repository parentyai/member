'use strict';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

function buildObsMessage(input) {
  const payload = input || {};
  const action = payload.action || 'unknown';
  const result = payload.result || 'unknown';
  const requestId = payload.requestId || null;
  const lineUserId = payload.lineUserId || null;
  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};

  const parts = ['[OBS]', `action=${action}`, `result=${result}`];
  if (requestId) parts.push(`requestId=${requestId}`);
  if (lineUserId) parts.push(`lineUserId=${lineUserId}`);

  const metaKeys = Object.keys(meta).sort();
  const metaJson = {};
  metaKeys.forEach((key) => {
    const raw = meta[key];
    const normalized = normalizeValue(raw);
    if (normalized !== null) {
      parts.push(`${key}=${normalized}`);
      return;
    }
    if (raw !== undefined) {
      metaJson[key] = raw;
    }
  });

  const metaJsonKeys = Object.keys(metaJson);
  if (metaJsonKeys.length) {
    const ordered = {};
    metaJsonKeys.sort().forEach((key) => {
      ordered[key] = metaJson[key];
    });
    parts.push(`meta_json=${JSON.stringify(ordered)}`);
  }

  return parts.join(' ');
}

function emitObs(input) {
  const payload = input || {};
  const logger = payload.logger || console.log;
  const message = buildObsMessage(payload);
  logger(message);
  return message;
}

module.exports = {
  emitObs,
  buildObsMessage
};
