'use strict';

const crypto = require('crypto');

function computeInputHash(promptPayload) {
  if (!promptPayload) return null;
  const snapshot = {
    system: promptPayload.system || null,
    user: promptPayload.user || null,
    schemaVersion: promptPayload.schemaVersion || null,
    constraints: promptPayload.constraints || null
  };
  const text = JSON.stringify(snapshot);
  return crypto.createHash('sha256').update(text).digest('hex');
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function shouldRefreshOpsAssist(params) {
  const payload = params || {};
  const cache = payload.cache || null;
  const inputHash = payload.inputHash || null;
  const force = Boolean(payload.force);
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();

  if (force) return { refresh: true, reason: 'force' };
  if (!cache) return { refresh: true, reason: 'cache_miss' };

  if (!cache.inputHash || !inputHash) {
    return { refresh: true, reason: 'missing_input_hash' };
  }
  if (cache.inputHash !== inputHash) {
    return { refresh: true, reason: 'input_changed' };
  }

  if (cache.expiresAt) {
    const expiresAtMs = toMillis(cache.expiresAt);
    if (!expiresAtMs) return { refresh: true, reason: 'invalid_expiry' };
    if (nowMs >= expiresAtMs) return { refresh: true, reason: 'expired' };
  } else {
    return { refresh: true, reason: 'missing_expiry' };
  }

  return { refresh: false, reason: 'cache_hit' };
}

module.exports = {
  computeInputHash,
  shouldRefreshOpsAssist
};
