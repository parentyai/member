'use strict';

const { RESULT_STATUS, SIGNAL_STATUS } = require('./constants');
const {
  createEvaluatorBlocker,
  uniqueByCode,
  mergeSourceCollections
} = require('./scoreHelpers');
const { createIssueCandidate } = require('./issueCandidates');
const { evaluateToneSafetySignals } = require('./signals/evaluateToneSafetySignals');
const { evaluateNaturalnessSignals } = require('./signals/evaluateNaturalnessSignals');
const { evaluateContinuitySignals } = require('./signals/evaluateContinuitySignals');
const { evaluateSpecificitySignals } = require('./signals/evaluateSpecificitySignals');
const { evaluateProceduralUtilitySignals } = require('./signals/evaluateProceduralUtilitySignals');
const { evaluateKnowledgeUseSignals } = require('./signals/evaluateKnowledgeUseSignals');
const { evaluateFallbackRepetitionSignals } = require('./signals/evaluateFallbackRepetitionSignals');
const { buildConversationQualityEvidence } = require('./buildConversationQualityEvidence');

function signalStatus(result) {
  return result && typeof result.status === 'string' ? result.status : SIGNAL_STATUS.UNAVAILABLE;
}

function issueSignalCodes() {
  return Array.from(new Set([]
    .concat(...Array.from(arguments).map((result) =>
      Array.isArray(result && result.supportingSignals)
        ? result.supportingSignals.map((item) => item && item.code).filter(Boolean)
        : []
    ))));
}

function buildIssueCandidates(reviewUnit, signalResults, combinedBlockers) {
  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const slice = reviewUnit && reviewUnit.slice ? reviewUnit.slice : 'other';
  const issues = [];
  const naturalness = signalResults.naturalness;
  const continuity = signalResults.continuity;
  const specificity = signalResults.specificity;
  const proceduralUtility = signalResults.proceduralUtility;
  const knowledgeUse = signalResults.knowledgeUse;
  const fallbackRepetition = signalResults.fallbackRepetition;

  if (
    slice === 'broad'
    && [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(specificity))
    && [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(proceduralUtility))
    && typeof telemetry.fallbackTemplateKind === 'string'
    && telemetry.fallbackTemplateKind.includes('generic')
  ) {
    issues.push(createIssueCandidate('broad_abstract_escape', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.88,
      reasons: ['broad slice answer stayed generic and did not provide concrete next steps'],
      supportingSignalCodes: issueSignalCodes(specificity, proceduralUtility, fallbackRepetition)
    }));
  }

  if (
    slice === 'follow-up'
    && reviewUnit
    && reviewUnit.priorContextSummary
    && reviewUnit.priorContextSummary.available === true
    && telemetry.priorContextUsed === false
    && [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(continuity))
  ) {
    issues.push(createIssueCandidate('followup_context_reset', {
      slice,
      status: signalStatus(continuity) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.9,
      reasons: ['follow-up slice had prior context available but continuity signals indicate a reset'],
      supportingSignalCodes: issueSignalCodes(continuity)
    }));
  }

  if (
    slice === 'city'
    && telemetry.cityPackCandidateAvailable === true
    && telemetry.cityPackUsedInAnswer === false
    && [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(specificity))
  ) {
    issues.push(createIssueCandidate('city_specificity_missing', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.86,
      reasons: ['city slice had city signals but the answer did not use city pack grounding'],
      supportingSignalCodes: issueSignalCodes(specificity, knowledgeUse)
    }));
  }

  if ([SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(proceduralUtility))) {
    issues.push(createIssueCandidate('next_step_missing', {
      slice,
      status: signalStatus(proceduralUtility) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.78,
      reasons: ['assistant reply lacks a concrete next-step structure'],
      supportingSignalCodes: issueSignalCodes(proceduralUtility)
    }));
  }

  if (
    fallbackRepetition
    && fallbackRepetition.value >= 0.4
    && telemetry.replyTemplateFingerprint
    && telemetry.genericFallbackSlice
  ) {
    issues.push(createIssueCandidate('repeated_template_response', {
      slice,
      status: signalStatus(fallbackRepetition),
      confidence: fallbackRepetition.value >= 0.65 ? 0.84 : 0.66,
      reasons: ['generic fallback path exposes stable template repetition risk'],
      supportingSignalCodes: issueSignalCodes(fallbackRepetition)
    }));
  }

  if (
    [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(knowledgeUse))
    && (
      telemetry.groundedCandidateAvailable === true
      || telemetry.cityPackCandidateAvailable === true
      || telemetry.savedFaqCandidateAvailable === true
    )
    && telemetry.knowledgeCandidateUsed === false
  ) {
    issues.push(createIssueCandidate('knowledge_activation_missing', {
      slice,
      status: signalStatus(knowledgeUse) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.82,
      reasons: ['knowledge candidate signals were present without downstream activation'],
      supportingSignalCodes: issueSignalCodes(knowledgeUse)
    }));
  }

  if (telemetry.savedFaqCandidateAvailable === true && telemetry.savedFaqUsedInAnswer === false) {
    issues.push(createIssueCandidate('saved_faq_unused', {
      slice,
      status: SIGNAL_STATUS.WARN,
      confidence: 0.8,
      reasons: ['saved FAQ candidate was available but not used'],
      supportingSignalCodes: issueSignalCodes(knowledgeUse)
    }));
  }

  if (telemetry.cityPackCandidateAvailable === true && telemetry.cityPackUsedInAnswer === false) {
    issues.push(createIssueCandidate('city_pack_unused', {
      slice,
      status: SIGNAL_STATUS.WARN,
      confidence: 0.8,
      reasons: ['city pack candidate was available but not used'],
      supportingSignalCodes: issueSignalCodes(knowledgeUse, specificity)
    }));
  }

  if (combinedBlockers.some((blocker) => blocker && blocker.code === 'insufficient_context_for_followup_judgement')) {
    issues.push(createIssueCandidate('followup_context_reset', {
      slice,
      status: SIGNAL_STATUS.WARN,
      confidence: 0.32,
      reasons: ['follow-up context reset is plausible but confidence is reduced by missing context evidence'],
      supportingSignalCodes: issueSignalCodes(continuity)
    }));
  }

  return uniqueByCode(issues);
}

function buildOverallStatus(signalResults, blockers) {
  if (Array.isArray(blockers) && blockers.length > 0) return RESULT_STATUS.BLOCKED;
  const statuses = Object.values(signalResults).map((result) => signalStatus(result));
  if (statuses.includes(SIGNAL_STATUS.FAIL)) return RESULT_STATUS.FAIL;
  if (statuses.includes(SIGNAL_STATUS.WARN)) return RESULT_STATUS.WARN;
  return RESULT_STATUS.PASS;
}

function evaluateConversationQuality(reviewUnit) {
  const toneSafety = evaluateToneSafetySignals(reviewUnit);
  const signalResults = {
    naturalness: evaluateNaturalnessSignals(reviewUnit, { toneSafety }),
    continuity: evaluateContinuitySignals(reviewUnit),
    specificity: evaluateSpecificitySignals(reviewUnit),
    proceduralUtility: evaluateProceduralUtilitySignals(reviewUnit),
    knowledgeUse: evaluateKnowledgeUseSignals(reviewUnit),
    fallbackRepetition: evaluateFallbackRepetitionSignals(reviewUnit)
  };

  const inheritedBlockers = Array.isArray(reviewUnit && reviewUnit.observationBlockers)
    ? reviewUnit.observationBlockers
    : [];
  const evaluatorBlockers = [];
  if (inheritedBlockers.some((item) => item && item.code === 'missing_trace_evidence')) {
    evaluatorBlockers.push(createEvaluatorBlocker('insufficient_trace_evidence'));
  }
  Object.values(signalResults).forEach((result) => {
    if (Array.isArray(result && result.blockers)) evaluatorBlockers.push(...result.blockers);
  });
  const combinedBlockers = uniqueByCode(inheritedBlockers.concat(evaluatorBlockers));
  const issueCandidates = buildIssueCandidates(reviewUnit, signalResults, combinedBlockers);
  const supportingEvidence = buildConversationQualityEvidence({
    reviewUnit,
    signalResults,
    issueCandidates
  });

  return {
    reviewUnitId: reviewUnit && reviewUnit.reviewUnitId ? reviewUnit.reviewUnitId : null,
    slice: reviewUnit && reviewUnit.slice ? reviewUnit.slice : 'other',
    status: buildOverallStatus(signalResults, combinedBlockers),
    observationBlockers: combinedBlockers,
    signals: {
      naturalness: signalResults.naturalness,
      continuity: signalResults.continuity,
      specificity: signalResults.specificity,
      proceduralUtility: signalResults.proceduralUtility,
      knowledgeUse: signalResults.knowledgeUse,
      fallbackRepetition: signalResults.fallbackRepetition
    },
    issueCandidates,
    supportingEvidence,
    provenance: 'review_unit',
    sourceCollections: mergeSourceCollections(
      reviewUnit && reviewUnit.sourceCollections,
      ['review_unit']
    )
  };
}

module.exports = {
  evaluateConversationQuality
};
