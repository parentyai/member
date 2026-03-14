'use strict';

const {
  SIGNAL_THRESHOLDS,
  ACTIONABLE_PATTERNS,
  ORDER_MARKER_PATTERNS,
  ABSTRACT_EXPLANATION_PATTERNS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeText,
  clamp01,
  createSupportingSignal,
  buildQualityStatus,
  countPatternMatches
} = require('../scoreHelpers');

function evaluateProceduralUtilitySignals(reviewUnit) {
  const replyText = normalizeText(reviewUnit && reviewUnit.assistantReply && reviewUnit.assistantReply.text);
  if (!replyText) {
    return {
      value: 0,
      status: SIGNAL_STATUS.BLOCKED,
      supportingSignals: [
        createSupportingSignal('missing_assistant_reply_for_procedural_utility', 'blocked', 'assistant reply text is required for procedural utility evaluation')
      ],
      blockers: []
    };
  }

  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const supportingSignals = [];
  let score = 0.24;

  const actionableHits = countPatternMatches(replyText, ACTIONABLE_PATTERNS);
  if (actionableHits > 0) {
    score += Math.min(0.34, actionableHits * 0.08);
    supportingSignals.push(createSupportingSignal(
      'actionable_step_phrase_detected',
      'positive',
      'assistant reply contains concrete next-step language',
      { count: actionableHits }
    ));
  }

  const orderHits = countPatternMatches(replyText, ORDER_MARKER_PATTERNS);
  if (orderHits > 0) {
    score += Math.min(0.18, orderHits * 0.09);
    supportingSignals.push(createSupportingSignal(
      'ordered_guidance_detected',
      'positive',
      'assistant reply gives ordered or enumerated guidance',
      { count: orderHits }
    ));
  }

  if (Array.isArray(telemetry.committedNextActions) && telemetry.committedNextActions.length > 0) {
    score += 0.16;
    supportingSignals.push(createSupportingSignal(
      'committed_next_actions_present',
      'positive',
      'telemetry recorded committed next actions',
      { count: telemetry.committedNextActions.length }
    ));
  }

  if (normalizeText(telemetry.committedFollowupQuestion)) {
    score += 0.08;
    supportingSignals.push(createSupportingSignal(
      'committed_followup_question_present',
      'positive',
      'telemetry recorded a follow-up question for the next turn'
    ));
  }

  if (telemetry.directAnswerApplied === true) {
    score += 0.08;
    supportingSignals.push(createSupportingSignal(
      'direct_answer_applied',
      'positive',
      'telemetry shows the answer tried direct-answer-first mode'
    ));
  }

  const abstractHits = countPatternMatches(replyText, ABSTRACT_EXPLANATION_PATTERNS);
  if (abstractHits > 0 && actionableHits === 0) {
    score -= Math.min(0.24, abstractHits * 0.12);
    supportingSignals.push(createSupportingSignal(
      'abstract_reply_without_next_step',
      'negative',
      'assistant reply stays abstract without concrete next steps',
      { count: abstractHits }
    ));
  }

  score = clamp01(score);
  return {
    value: score,
    status: buildQualityStatus(score, SIGNAL_THRESHOLDS.proceduralUtility),
    supportingSignals,
    blockers: []
  };
}

module.exports = {
  evaluateProceduralUtilitySignals
};
