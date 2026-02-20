'use strict';

const BLOCKED_REASON_CATEGORY_MAP = Object.freeze({
  kb_no_match: 'NO_KB_MATCH',
  low_confidence: 'LOW_CONFIDENCE',
  direct_url_forbidden: 'DIRECT_URL_DETECTED',
  warn_link_blocked: 'WARN_LINK_BLOCKED',
  restricted_field_detected: 'SENSITIVE_QUERY',
  secret_field_detected: 'SENSITIVE_QUERY',
  guide_only_mode_blocked: 'GUIDE_MODE_BLOCKED',
  personalization_not_allowed: 'PERSONALIZATION_BLOCKED',
  consent_missing: 'CONSENT_MISSING',
  contact_source_required: 'CONTACT_SOURCE_REQUIRED',
  kb_schema_invalid: 'KB_SCHEMA_INVALID',
  llm_api_error: 'LLM_API_ERROR',
  llm_timeout: 'LLM_API_ERROR',
  adapter_missing: 'LLM_API_ERROR'
});

function toBlockedReasonCategory(blockedReason, options) {
  const settings = options || {};
  const nullOnDisabled = settings.nullOnDisabled === true;
  const reason = String(blockedReason || '').trim();
  if (!reason) return nullOnDisabled ? null : 'UNKNOWN';
  if (nullOnDisabled && (reason === 'disabled' || reason === 'llm_disabled')) return null;
  return BLOCKED_REASON_CATEGORY_MAP[reason] || 'UNKNOWN';
}

module.exports = {
  toBlockedReasonCategory
};
