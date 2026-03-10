'use strict';

const REQUIRED_KEYS = Object.freeze([
  'record_id',
  'record_type',
  'source_system',
  'source_snapshot_ref',
  'effective_from',
  'authority_tier',
  'binding_level',
  'status',
  'retention_tag',
  'pii_class',
  'access_scope',
  'masking_policy',
  'deletion_policy',
  'created_at',
  'updated_at'
]);

const ADOPTION_STATES = Object.freeze({
  llm_action_logs: 'enforced',
  llm_quality_logs: 'enforced',
  faq_answer_logs: 'enforced',
  source_refs: 'enforced',
  memory_task: 'enforced',
  memory_session: 'enforced',
  memory_profile: 'enforced',
  memory_compliance: 'enforced',
  delivery_records: 'enforced',
  liff_synthetic_events: 'enforced'
});

const ALLOWED_AUTHORITIES = new Set([
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

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized;
}

function parseBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback === true;
}

function resolveEnvelopeAdoptionState(dataClass) {
  const key = normalizeString(dataClass);
  const configured = Object.prototype.hasOwnProperty.call(ADOPTION_STATES, key)
    ? ADOPTION_STATES[key]
    : 'planned';
  if (!parseBooleanEnv('ENABLE_DATA_ENVELOPE_ENFORCED_V1', true)) return 'shadow_write';
  return configured;
}

function validateDateString(value) {
  const text = normalizeString(value);
  if (!text) return false;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime());
}

function validateRecordEnvelope(recordEnvelope) {
  const payload = recordEnvelope && typeof recordEnvelope === 'object' ? recordEnvelope : null;
  if (!payload) {
    return {
      ok: false,
      missingKeys: REQUIRED_KEYS.slice(),
      invalidKeys: []
    };
  }

  const missingKeys = [];
  const invalidKeys = [];
  REQUIRED_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      missingKeys.push(key);
      return;
    }
    const value = payload[key];
    if (key === 'access_scope') {
      if (!Array.isArray(value) || value.length < 1 || value.some((item) => !normalizeString(item))) {
        invalidKeys.push(key);
      }
      return;
    }
    if (!normalizeString(value)) invalidKeys.push(key);
  });

  if (payload.authority_tier && !ALLOWED_AUTHORITIES.has(normalizeString(payload.authority_tier).toUpperCase())) {
    invalidKeys.push('authority_tier');
  }
  if (payload.binding_level && !ALLOWED_BINDING_LEVELS.has(normalizeString(payload.binding_level).toUpperCase())) {
    invalidKeys.push('binding_level');
  }
  if (payload.status && !ALLOWED_STATUS.has(normalizeString(payload.status).toLowerCase())) {
    invalidKeys.push('status');
  }
  if (payload.effective_from && !validateDateString(payload.effective_from)) invalidKeys.push('effective_from');
  if (payload.created_at && !validateDateString(payload.created_at)) invalidKeys.push('created_at');
  if (payload.updated_at && !validateDateString(payload.updated_at)) invalidKeys.push('updated_at');
  if (payload.effective_to !== null && payload.effective_to !== undefined && !validateDateString(payload.effective_to)) {
    invalidKeys.push('effective_to');
  }

  return {
    ok: missingKeys.length === 0 && invalidKeys.length === 0,
    missingKeys,
    invalidKeys
  };
}

function assertRecordEnvelopeCompliance(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const dataClass = normalizeString(payload.dataClass) || 'unknown';
  const adoptionState = resolveEnvelopeAdoptionState(dataClass);
  if (adoptionState !== 'enforced') {
    return { enforced: false, adoptionState, ok: true, missingKeys: [], invalidKeys: [] };
  }

  const validation = validateRecordEnvelope(payload.recordEnvelope);
  if (!validation.ok) {
    const err = new Error(
      `recordEnvelope compliance failed: dataClass=${dataClass} missing=${validation.missingKeys.join(',')} invalid=${validation.invalidKeys.join(',')}`
    );
    err.code = 'RECORD_ENVELOPE_COMPLIANCE_FAILED';
    err.dataClass = dataClass;
    err.missingKeys = validation.missingKeys;
    err.invalidKeys = validation.invalidKeys;
    throw err;
  }

  return {
    enforced: true,
    adoptionState,
    ok: true,
    missingKeys: [],
    invalidKeys: []
  };
}

module.exports = {
  REQUIRED_KEYS,
  ADOPTION_STATES,
  resolveEnvelopeAdoptionState,
  validateRecordEnvelope,
  assertRecordEnvelopeCompliance
};

