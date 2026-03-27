'use strict';

const REVIEW_UNIT_SLICES = Object.freeze(['broad', 'housing', 'city', 'follow-up', 'other']);

const BLOCKER_CATALOG = Object.freeze({
  missing_user_message: Object.freeze({
    severity: 'high',
    message: 'Masked user message snapshot is unavailable.',
    source: 'conversation_review_snapshots'
  }),
  missing_assistant_reply: Object.freeze({
    severity: 'high',
    message: 'Masked assistant reply snapshot is unavailable.',
    source: 'conversation_review_snapshots'
  }),
  missing_prior_context_summary: Object.freeze({
    severity: 'low',
    message: 'Prior context summary is unavailable for this review unit.',
    source: 'conversation_review_snapshots'
  }),
  missing_trace_evidence: Object.freeze({
    severity: 'medium',
    message: 'Trace evidence is unavailable or incomplete for this review unit.',
    source: 'trace_bundle'
  }),
  missing_action_log_evidence: Object.freeze({
    severity: 'medium',
    message: 'LLM action log evidence is unavailable for this review unit.',
    source: 'llm_action_logs'
  }),
  missing_faq_evidence: Object.freeze({
    severity: 'low',
    message: 'FAQ evidence expected for this review unit is unavailable.',
    source: 'faq_answer_logs'
  }),
  transcript_not_reviewable: Object.freeze({
    severity: 'high',
    message: 'Conversation transcript is not reviewable because required masked text is missing.',
    source: 'conversation_review_snapshots'
  }),
  target_validation_failed: Object.freeze({
    severity: 'high',
    message: 'Desktop target validation failed before the execute run could be trusted.',
    source: 'line_desktop_patrol_trace'
  }),
  send_not_confirmed: Object.freeze({
    severity: 'high',
    message: 'Desktop send was not confirmed, so the execute trace cannot be trusted as a sent run.',
    source: 'line_desktop_patrol_trace'
  }),
  post_send_reply_missing: Object.freeze({
    severity: 'medium',
    message: 'The desktop execute run sent successfully, but a reply was not observed in the bounded follow-up window.',
    source: 'line_desktop_patrol_trace'
  }),
  visible_correlation_ambiguous: Object.freeze({
    severity: 'medium',
    message: 'Visible desktop rows changed, but the send/reply correlation remained ambiguous.',
    source: 'line_desktop_patrol_trace'
  })
});

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
}

function normalizeReviewSlice(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (normalized === 'followup' || normalized === 'follow-up') return 'follow-up';
  return REVIEW_UNIT_SLICES.includes(normalized) ? normalized : null;
}

module.exports = {
  REVIEW_UNIT_SLICES,
  BLOCKER_CATALOG,
  normalizeText,
  normalizeToken,
  normalizeReviewSlice
};
