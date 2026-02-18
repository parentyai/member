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
  consent_missing: 'CONSENT_MISSING'
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
