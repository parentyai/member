'use strict';

const crypto = require('crypto');

function normalizeText(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const asDate = value.toDate();
    return asDate instanceof Date && !Number.isNaN(asDate.getTime()) ? asDate : null;
  }
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value, fallback) {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toISOString();
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === false) return value;
  return fallback === true;
}

function normalizeInteger(value, fallback, minValue) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const normalized = Math.floor(num);
  if (Number.isFinite(minValue) && normalized < minValue) return minValue;
  return normalized;
}

function resolvePositiveDaySpan(startValue, endValue, fallback) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end) return fallback;
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return fallback;
  return Math.max(1, Math.ceil(diffMs / 86400000));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
  ));
}

function normalizeObject(value, fallback) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback && typeof fallback === 'object' ? fallback : {};
  return JSON.parse(JSON.stringify(value));
}

function buildDeterministicUuid(seed, fallbackSeed) {
  const value = normalizeText(seed, normalizeText(fallbackSeed, 'canonical-core-fallback'));
  const hash = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hash[12] = '5';
  hash[16] = ['8', '9', 'a', 'b'][parseInt(hash[16], 16) % 4];
  return `${hash.slice(0, 8).join('')}-${hash.slice(8, 12).join('')}-${hash.slice(12, 16).join('')}-${hash.slice(16, 20).join('')}-${hash.slice(20, 32).join('')}`;
}

function mapAuthorityTierToCanonical(value, fallback) {
  const normalized = normalizeText(value, '').toUpperCase();
  if (normalized === 'T0' || normalized === 'T1' || normalized === 'T2' || normalized === 'T3' || normalized === 'T4') return normalized;
  if (normalized.includes('T0')) return 'T0';
  if (normalized.includes('T1')) return 'T1';
  if (normalized.includes('T2')) return 'T2';
  if (normalized.includes('T4')) return 'T4';
  if (normalized.includes('T3')) return 'T3';
  return fallback || 'T3';
}

function mapBindingLevelToCanonical(value, fallback) {
  const normalized = normalizeText(value, '').toLowerCase();
  if (normalized === 'mandatory'
    || normalized === 'policy_bound'
    || normalized === 'recommended'
    || normalized === 'informative'
    || normalized === 'anecdotal') {
    return normalized;
  }
  if (normalized === 'policy') return 'policy_bound';
  if (normalized === 'reference') return 'informative';
  if (normalized === 'unknown') return fallback || 'informative';
  return fallback || 'informative';
}

function extractHostname(url, fallback) {
  const resolved = normalizeText(url, '');
  if (!resolved) return fallback || 'unknown-source';
  try {
    const parsed = new URL(resolved);
    return normalizeText(parsed.hostname, fallback || 'unknown-source');
  } catch (_error) {
    return fallback || 'unknown-source';
  }
}

function resolveCountryCodeFromRegionKey(regionKey, fallback) {
  const normalized = normalizeText(regionKey, '').toLowerCase();
  if (!normalized) return fallback || 'TBD';
  const match = normalized.match(/^([a-z]{2})(?:[-_:]|$)/);
  if (!match) return fallback || 'TBD';
  return match[1].toUpperCase();
}

function resolveCountryCodeFromLocale(locale, fallback) {
  const normalized = normalizeText(locale, '');
  if (!normalized) return fallback || 'TBD';
  const match = normalized.match(/[-_]([A-Za-z]{2})$/);
  if (!match) return fallback || 'TBD';
  return match[1].toUpperCase();
}

function resolveScopeKey(value, fallback) {
  const normalized = normalizeText(value, '');
  if (!normalized) return fallback || 'GLOBAL';
  return normalized.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}

function resolveReviewerStatus(params, fallback) {
  const payload = params && typeof params === 'object' ? params : {};
  const status = normalizeText(payload.status, '').toLowerCase();
  const lifecycleState = normalizeText(payload.lifecycleState, '').toLowerCase();
  if (status === 'needs_review') return 'needs_review';
  if (lifecycleState === 'approved' && (status === 'active' || status === 'ok')) return 'approved';
  if (lifecycleState === 'rejected') return 'rejected';
  if (status === 'blocked' || status === 'dead' || status === 'retired' || status === 'disabled') return 'rejected';
  return fallback || 'draft';
}

function resolveStaleFlag(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const status = normalizeText(payload.status, '').toLowerCase();
  if (status === 'dead' || status === 'retired' || status === 'disabled') return true;
  const effectiveTo = toDate(payload.effectiveTo);
  if (effectiveTo && effectiveTo.getTime() <= Date.now()) return true;
  return false;
}

function slugify(value, fallback) {
  const normalized = normalizeText(value, '');
  if (!normalized) return fallback || 'canonical-core';
  const slug = normalized
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback || 'canonical-core';
}

module.exports = {
  normalizeText,
  toDate,
  toIsoString,
  normalizeBoolean,
  normalizeInteger,
  resolvePositiveDaySpan,
  normalizeStringArray,
  normalizeObject,
  buildDeterministicUuid,
  mapAuthorityTierToCanonical,
  mapBindingLevelToCanonical,
  extractHostname,
  resolveCountryCodeFromRegionKey,
  resolveCountryCodeFromLocale,
  resolveScopeKey,
  resolveReviewerStatus,
  resolveStaleFlag,
  slugify
};
