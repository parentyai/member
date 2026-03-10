'use strict';

const ALLOWED_AUTHORITY_TIERS = new Set([
  'T0_LAW_FORM',
  'T1_OFFICIAL_OPERATION',
  'T2_PUBLIC_DATA',
  'T3_VENDOR',
  'T4_COMMUNITY',
  'UNKNOWN'
]);

const ALLOWED_BINDING_LEVELS = new Set([
  'MANDATORY',
  'POLICY',
  'RECOMMENDED',
  'REFERENCE',
  'UNKNOWN'
]);

const ALLOWED_STATUS = new Set(['draft', 'active', 'superseded', 'deprecated', 'deleted']);

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeDateTime(value, fallbackIso) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return fallbackIso;
}

function normalizeStringArray(values, fallback) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeString(item, '');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.length ? out : fallback;
}

function resolveAuthorityTier(value, fallback) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return fallback;
  return ALLOWED_AUTHORITY_TIERS.has(normalized) ? normalized : fallback;
}

function resolveBindingLevel(value, fallback) {
  const normalized = normalizeString(value, '').toUpperCase();
  if (!normalized) return fallback;
  return ALLOWED_BINDING_LEVELS.has(normalized) ? normalized : fallback;
}

function resolveStatus(value, fallback) {
  const normalized = normalizeString(value, '').toLowerCase();
  if (!normalized) return fallback;
  return ALLOWED_STATUS.has(normalized) ? normalized : fallback;
}

function buildUniversalRecordEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowIso = new Date().toISOString();
  const recordType = normalizeString(payload.recordType, 'unknown_record');
  const effectiveFrom = normalizeDateTime(payload.effectiveFrom, nowIso);
  const createdAt = normalizeDateTime(payload.createdAt, nowIso);
  const updatedAt = normalizeDateTime(payload.updatedAt, nowIso);
  return {
    record_id: normalizeString(payload.recordId, `${recordType}_auto`),
    record_type: recordType,
    source_system: normalizeString(payload.sourceSystem, 'member_firestore'),
    source_snapshot_ref: normalizeString(payload.sourceSnapshotRef, 'snapshot:unknown'),
    effective_from: effectiveFrom,
    effective_to: payload.effectiveTo ? normalizeDateTime(payload.effectiveTo, null) : null,
    authority_tier: resolveAuthorityTier(payload.authorityTier, 'UNKNOWN'),
    binding_level: resolveBindingLevel(payload.bindingLevel, 'UNKNOWN'),
    jurisdiction: normalizeString(payload.jurisdiction, null),
    status: resolveStatus(payload.status, 'active'),
    retention_tag: normalizeString(payload.retentionTag, null),
    pii_class: normalizeString(payload.piiClass, null),
    access_scope: normalizeStringArray(payload.accessScope, ['operator']),
    masking_policy: normalizeString(payload.maskingPolicy, null),
    deletion_policy: normalizeString(payload.deletionPolicy, null),
    created_at: createdAt,
    updated_at: updatedAt
  };
}

module.exports = {
  buildUniversalRecordEnvelope
};
