'use strict';

const {
  SIGNAL_THRESHOLDS,
  FOLLOWUP_RESET_PATTERNS,
  GENERIC_TEMPLATE_TOKENS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeText,
  clamp01,
  createSupportingSignal,
  createEvaluatorBlocker,
  buildQualityStatus,
  countPatternMatches,
  includesTemplateToken
} = require('../scoreHelpers');

function evaluateContinuitySignals(reviewUnit) {
  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const slice = reviewUnit && reviewUnit.slice;
  const replyText = normalizeText(reviewUnit && reviewUnit.assistantReply && reviewUnit.assistantReply.text);
  const followupExpected = slice === 'follow-up'
    || telemetry.priorContextUsed === true
    || telemetry.followupResolvedFromHistory === true
    || (reviewUnit && reviewUnit.priorContextSummary && reviewUnit.priorContextSummary.available === true);

  if (!followupExpected) {
    return {
      value: 0,
      status: SIGNAL_STATUS.UNAVAILABLE,
      supportingSignals: [
        createSupportingSignal('continuity_not_applicable', 'neutral', 'follow-up continuity is not expected for this review unit')
      ],
      blockers: []
    };
  }

  if (
    reviewUnit
    && reviewUnit.priorContextSummary
    && reviewUnit.priorContextSummary.available !== true
    && telemetry.priorContextUsed !== true
    && telemetry.followupResolvedFromHistory !== true
  ) {
    return {
      value: 0,
      status: SIGNAL_STATUS.BLOCKED,
      supportingSignals: [
        createSupportingSignal('missing_prior_context_summary_for_followup', 'blocked', 'prior context summary is unavailable for follow-up continuity judgement')
      ],
      blockers: [createEvaluatorBlocker('insufficient_context_for_followup_judgement')]
    };
  }

  const supportingSignals = [];
  let score = 0.35;

  if (telemetry.priorContextUsed === true) {
    score += 0.3;
    supportingSignals.push(createSupportingSignal('prior_context_used', 'positive', 'prior context was explicitly consumed'));
  } else if (telemetry.priorContextUsed === false) {
    score -= 0.18;
    supportingSignals.push(createSupportingSignal('prior_context_not_used', 'negative', 'prior context was available but not used'));
  }

  if (telemetry.followupResolvedFromHistory === true) {
    score += 0.25;
    supportingSignals.push(createSupportingSignal('followup_resolved_from_history', 'positive', 'history resolution signal is present'));
  } else if (telemetry.followupResolvedFromHistory === false) {
    score -= 0.12;
    supportingSignals.push(createSupportingSignal('followup_history_resolution_missing', 'negative', 'history resolution signal is explicitly false'));
  }

  if (Number.isFinite(Number(telemetry.contextCarryScore)) && Number(telemetry.contextCarryScore) >= 0.5) {
    score += 0.12;
    supportingSignals.push(createSupportingSignal(
      'context_carry_score_positive',
      'positive',
      'context carry score supports continuity',
      { value: Number(telemetry.contextCarryScore) }
    ));
  }

  if (replyText) {
    const resetHits = countPatternMatches(replyText, FOLLOWUP_RESET_PATTERNS);
    if (resetHits > 0) {
      score -= Math.min(0.24, resetHits * 0.12);
      supportingSignals.push(createSupportingSignal(
        'followup_reset_phrase_detected',
        'negative',
        'assistant reply resets the conversation instead of carrying context',
        { count: resetHits }
      ));
    }
  }

  if (includesTemplateToken(telemetry.fallbackTemplateKind, GENERIC_TEMPLATE_TOKENS)) {
    score -= 0.08;
    supportingSignals.push(createSupportingSignal(
      'generic_followup_template',
      'negative',
      'generic fallback template is correlated with follow-up reset'
    ));
  }

  score = clamp01(score);
  return {
    value: score,
    status: buildQualityStatus(score, SIGNAL_THRESHOLDS.continuity),
    supportingSignals,
    blockers: []
  };
}

module.exports = {
  evaluateContinuitySignals
};
