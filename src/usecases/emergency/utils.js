'use strict';

const crypto = require('crypto');

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function stableHash(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value || {});
  return crypto.createHash('sha256').update(source).digest('hex');
}

function stableKey(parts) {
  const values = Array.isArray(parts) ? parts : [];
  const raw = values.map((item) => (item == null ? '' : String(item))).join('::');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 24);
}

function pickChangedKeys(previous, current, candidates) {
  const keys = Array.isArray(candidates) ? candidates : [];
  const changed = [];
  keys.forEach((key) => {
    const before = previous ? previous[key] : null;
    const after = current ? current[key] : null;
    const beforeJson = JSON.stringify(before == null ? null : before);
    const afterJson = JSON.stringify(after == null ? null : after);
    if (beforeJson !== afterJson) changed.push(key);
  });
  return changed;
}

function normalizeLimit(value, fallback, max) {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 50;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
  const maxValue = Number.isFinite(Number(max)) ? Number(max) : fallbackValue;
  return Math.min(Math.floor(parsed), maxValue);
}

module.exports = {
  normalizeString,
  toDate,
  toMillis,
  toIso,
  stableHash,
  stableKey,
  pickChangedKeys,
  normalizeLimit
};
