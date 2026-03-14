'use strict';

const {
  SIGNAL_THRESHOLDS,
  KNOWLEDGE_CANDIDATE_KINDS
} = require('../constants');
const {
  SIGNAL_STATUS,
  normalizeToken,
  clamp01,
  createSupportingSignal,
  createEvaluatorBlocker,
  buildQualityStatus
} = require('../scoreHelpers');

function selectedKnowledgeCandidate(selectedCandidateKind) {
  const normalized = normalizeToken(selectedCandidateKind);
  return KNOWLEDGE_CANDIDATE_KINDS.includes(normalized);
}

function evaluateKnowledgeUseSignals(reviewUnit) {
  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const supportingSignals = [];
  const knowledgeSignalsObserved = telemetry.cityPackCandidateAvailable !== null
    || telemetry.cityPackUsedInAnswer !== null
    || telemetry.savedFaqCandidateAvailable !== null
    || telemetry.savedFaqUsedInAnswer !== null
    || telemetry.groundedCandidateAvailable !== null
    || telemetry.knowledgeCandidateUsed !== null
    || Boolean(telemetry.knowledgeGroundingKind)
    || selectedKnowledgeCandidate(telemetry.selectedCandidateKind);

  if (!knowledgeSignalsObserved) {
    return {
      value: 0,
      status: SIGNAL_STATUS.UNAVAILABLE,
      supportingSignals: [
        createSupportingSignal('knowledge_signals_unavailable', 'blocked', 'knowledge-use signals are not available for this review unit')
      ],
      blockers: [createEvaluatorBlocker('insufficient_knowledge_signals')]
    };
  }

  let score = 0.38;

  if (telemetry.knowledgeCandidateUsed === true) {
    score += 0.24;
    supportingSignals.push(createSupportingSignal('knowledge_candidate_used', 'positive', 'knowledge-backed candidate was used'));
  } else if (telemetry.knowledgeCandidateUsed === false) {
    score -= 0.12;
    supportingSignals.push(createSupportingSignal('knowledge_candidate_not_used', 'negative', 'knowledge-backed candidate was explicitly not used'));
  }

  if (telemetry.cityPackCandidateAvailable === true) {
    if (telemetry.cityPackUsedInAnswer === true) {
      score += 0.18;
      supportingSignals.push(createSupportingSignal('city_pack_used', 'positive', 'city pack candidate was available and used'));
    } else {
      score -= 0.18;
      supportingSignals.push(createSupportingSignal('city_pack_unused', 'negative', 'city pack candidate was available but not used'));
    }
  }

  if (telemetry.savedFaqCandidateAvailable === true) {
    if (telemetry.savedFaqUsedInAnswer === true) {
      score += 0.18;
      supportingSignals.push(createSupportingSignal('saved_faq_used', 'positive', 'saved FAQ candidate was available and used'));
    } else {
      score -= 0.18;
      supportingSignals.push(createSupportingSignal('saved_faq_unused', 'negative', 'saved FAQ candidate was available but not used'));
    }
  }

  if (telemetry.groundedCandidateAvailable === true && telemetry.knowledgeCandidateUsed !== true) {
    score -= 0.12;
    supportingSignals.push(createSupportingSignal(
      'grounded_candidate_available_but_unused',
      'negative',
      'grounded candidate was available without activation'
    ));
  }

  if (selectedKnowledgeCandidate(telemetry.selectedCandidateKind) || normalizeToken(telemetry.knowledgeGroundingKind)) {
    score += 0.12;
    supportingSignals.push(createSupportingSignal(
      'knowledge_grounding_kind_present',
      'positive',
      'knowledge grounding metadata is present in telemetry'
    ));
  }

  score = clamp01(score);
  return {
    value: score,
    status: buildQualityStatus(score, SIGNAL_THRESHOLDS.knowledgeUse),
    supportingSignals,
    blockers: []
  };
}

module.exports = {
  evaluateKnowledgeUseSignals
};
