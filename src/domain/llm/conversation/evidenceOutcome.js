'use strict';

const EVIDENCE_OUTCOME = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  INSUFFICIENT: 'INSUFFICIENT',
  BLOCKED: 'BLOCKED'
});

const BLOCKING_REASONS = new Set([
  'external_instruction_detected',
  'provider_error',
  'provider_exception',
  'final_url_missing',
  'final_url_invalid',
  'short_url_blocked',
  'suspicious_tld_blocked',
  'denylist_blocked',
  'ip_literal_blocked',
  'auth_url_blocked',
  'concierge_compose_failed'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveEvidenceNeed(mode) {
  const normalized = normalizeText(mode).toUpperCase();
  if (normalized === 'B') return 'required';
  if (normalized === 'C') return 'optional';
  return 'none';
}

function resolveEvidenceOutcome(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const mode = normalizeText(payload.mode).toUpperCase() || 'A';
  const evidenceNeed = normalizeText(payload.evidenceNeed) || resolveEvidenceNeed(mode);
  const urlCount = Number.isFinite(Number(payload.urlCount)) ? Number(payload.urlCount) : 0;
  const blockedReasons = Array.isArray(payload.blockedReasons)
    ? payload.blockedReasons.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const hasBlockingReason = payload.injectionFindings === true || blockedReasons.some((reason) => BLOCKING_REASONS.has(reason));

  if (hasBlockingReason && (evidenceNeed === 'required' || urlCount <= 0)) {
    return {
      evidenceNeed,
      evidenceOutcome: EVIDENCE_OUTCOME.BLOCKED
    };
  }

  if (evidenceNeed === 'none') {
    return {
      evidenceNeed,
      evidenceOutcome: EVIDENCE_OUTCOME.SUPPORTED
    };
  }

  if (urlCount > 0) {
    return {
      evidenceNeed,
      evidenceOutcome: EVIDENCE_OUTCOME.SUPPORTED
    };
  }

  return {
    evidenceNeed,
    evidenceOutcome: EVIDENCE_OUTCOME.INSUFFICIENT
  };
}

module.exports = {
  EVIDENCE_OUTCOME,
  resolveEvidenceNeed,
  resolveEvidenceOutcome
};
