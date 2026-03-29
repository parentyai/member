'use strict';

const USER_FACING_SOURCE_TYPES = new Set([
  'official',
  'semi_official',
  'internal_approved'
]);

const OBSERVATIONAL_HINTS = ['blog', 'lived', 'observational'];

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function deriveHost(url) {
  const text = normalizeText(url);
  if (!text) return '';
  try {
    return new URL(text).hostname.toLowerCase();
  } catch (_err) {
    return '';
  }
}

function normalizeSourceType(value, fallbackCandidate) {
  const direct = normalizeText(value).toLowerCase();
  if (direct === 'official' || direct === 'semi_official' || direct === 'internal_approved') {
    return direct;
  }
  if (direct === 'observational_lived_source') return direct;

  const payload = fallbackCandidate && typeof fallbackCandidate === 'object' ? fallbackCandidate : {};
  const domainClass = normalizeText(payload.domainClass).toLowerCase();
  if (domainClass === 'gov' || domainClass === 'k12_district' || domainClass === 'school_public') {
    return 'official';
  }

  const rank = normalizeText(payload.rank).toUpperCase();
  if (rank === 'R0') return 'official';
  if (rank === 'R1') return 'semi_official';

  const source = normalizeText(payload.source || payload.sourceType).toLowerCase();
  if (source.includes('internal')) return 'internal_approved';
  if (OBSERVATIONAL_HINTS.some((hint) => source.includes(hint) || direct.includes(hint))) {
    return 'observational_lived_source';
  }

  const host = deriveHost(payload.url);
  if (host.endsWith('.gov') || host === 'gov') return 'official';
  if (host.endsWith('.edu') || host === 'edu') return 'semi_official';
  return 'unknown';
}

function normalizeAuthorityBand(input) {
  const sourceType = normalizeSourceType(input && input.source_type, input);
  if (sourceType === 'official') return 'primary_required';
  if (sourceType === 'semi_official') return 'primary_preferred';
  if (sourceType === 'internal_approved') return 'workflow_internal';
  return 'observational_only';
}

function freshnessFromScore(score) {
  if (!Number.isFinite(Number(score))) return 'unknown';
  const value = Number(score);
  if (value >= 0.8) return 'fresh';
  if (value >= 0.5) return 'mixed';
  return 'stale';
}

function freshnessFromDate(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return 'unknown';
  const ageMs = Math.max(0, Date.now() - parsed);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays <= 45) return 'fresh';
  if (ageDays <= 120) return 'mixed';
  return 'stale';
}

function normalizeFreshnessStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeText(payload.freshness_status || payload.freshnessStatus).toLowerCase();
  if (explicit === 'fresh' || explicit === 'mixed' || explicit === 'stale' || explicit === 'unknown') {
    return explicit;
  }
  const byScore = freshnessFromScore(payload.sourceFreshnessScore);
  if (byScore !== 'unknown') return byScore;
  const byUpdatedAt = freshnessFromDate(payload.updatedAt);
  if (byUpdatedAt !== 'unknown') return byUpdatedAt;
  return freshnessFromDate(payload.validUntil);
}

function isUserFacingLink(candidate) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const sourceType = normalizeSourceType(payload.source_type || payload.sourceType, payload);
  return USER_FACING_SOURCE_TYPES.has(sourceType);
}

module.exports = {
  USER_FACING_SOURCE_TYPES,
  normalizeSourceType,
  normalizeAuthorityBand,
  normalizeFreshnessStatus,
  isUserFacingLink
};
