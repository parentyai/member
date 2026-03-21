'use strict';

const { RESULT_STATUS, SIGNAL_STATUS } = require('./constants');
const {
  createEvaluatorBlocker,
  normalizeToken,
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

function includesToken(value, token) {
  const normalized = normalizeToken(value);
  if (!normalized) return false;
  return normalized.includes(String(token || '').toLowerCase());
}

function hasViolationCode(telemetry, code) {
  const payload = telemetry && typeof telemetry === 'object' ? telemetry : {};
  const normalizedCode = normalizeToken(code);
  if (!normalizedCode) return false;
  return (Array.isArray(payload.violationCodes) ? payload.violationCodes : []).some((item) => normalizeToken(item) === normalizedCode);
}

function isConciergePath(telemetry) {
  const payload = telemetry && typeof telemetry === 'object' ? telemetry : {};
  return [
    payload.selectedCandidateKind,
    payload.strategy,
    payload.strategyReason,
    payload.routeKind,
    payload.fallbackTemplateKind,
    payload.finalizerTemplateKind
  ].some((item) => includesToken(item, 'concierge') || includesToken(item, 'domain_concierge'));
}

function buildIssueCandidates(reviewUnit, signalResults, combinedBlockers) {
  const telemetry = reviewUnit && reviewUnit.telemetrySignals ? reviewUnit.telemetrySignals : {};
  const slice = reviewUnit && reviewUnit.slice ? reviewUnit.slice : 'other';
  const conciergePath = isConciergePath(telemetry);
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

  if (conciergePath && telemetry.directAnswerApplied === false) {
    issues.push(createIssueCandidate('concierge_direct_answer_missing', {
      slice,
      status: signalStatus(proceduralUtility) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.84,
      reasons: ['concierge route was selected but direct-answer-first was not applied'],
      supportingSignalCodes: issueSignalCodes(proceduralUtility, continuity)
    }));
  }

  if (
    conciergePath
    && slice === 'follow-up'
    && (telemetry.priorContextUsed === false || telemetry.followupResolvedFromHistory === false)
  ) {
    issues.push(createIssueCandidate('concierge_context_carry_missing', {
      slice,
      status: signalStatus(continuity) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.88,
      reasons: ['concierge follow-up lost context carry signals from prior turns'],
      supportingSignalCodes: issueSignalCodes(continuity)
    }));
  }

  if (
    conciergePath
    && (
      telemetry.groundedCandidateAvailable === true
      || telemetry.cityPackCandidateAvailable === true
      || telemetry.savedFaqCandidateAvailable === true
    )
    && telemetry.knowledgeCandidateUsed === false
  ) {
    issues.push(createIssueCandidate('concierge_knowledge_bypass', {
      slice,
      status: signalStatus(knowledgeUse) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: 0.86,
      reasons: ['concierge route bypassed available grounded knowledge candidates'],
      supportingSignalCodes: issueSignalCodes(knowledgeUse, specificity)
    }));
  }

  if (
    conciergePath
    && (
      (typeof telemetry.repeatRiskScore === 'number' && telemetry.repeatRiskScore >= 0.55)
      || (fallbackRepetition && fallbackRepetition.value >= 0.4)
      || includesToken(telemetry.fallbackTemplateKind, 'generic')
      || includesToken(telemetry.finalizerTemplateKind, 'generic')
    )
  ) {
    issues.push(createIssueCandidate('concierge_template_overuse', {
      slice,
      status: signalStatus(fallbackRepetition) === SIGNAL_STATUS.FAIL ? SIGNAL_STATUS.FAIL : SIGNAL_STATUS.WARN,
      confidence: fallbackRepetition && fallbackRepetition.value >= 0.65 ? 0.84 : 0.7,
      reasons: ['concierge route shows elevated template reuse/repetition risk'],
      supportingSignalCodes: issueSignalCodes(fallbackRepetition, naturalness)
    }));
  }

  if (
    conciergePath
    && [SIGNAL_STATUS.WARN, SIGNAL_STATUS.FAIL].includes(signalStatus(fallbackRepetition))
    && (
      includesToken(telemetry.fallbackTemplateKind, 'generic')
      || includesToken(telemetry.finalizerTemplateKind, 'generic')
      || telemetry.genericFallbackSlice === 'followup'
    )
  ) {
    issues.push(createIssueCandidate('generic_loop_fixed_reply', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.88,
      reasons: ['concierge reply reused a generic fixed skeleton instead of advancing the conversation'],
      supportingSignalCodes: issueSignalCodes(fallbackRepetition, continuity, naturalness)
    }));
  }

  if (hasViolationCode(telemetry, 'format_noncompliance') || hasViolationCode(telemetry, 'detail_drop')) {
    issues.push(createIssueCandidate('detail_format_drop', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.9,
      reasons: ['reply dropped requested detail or violated the requested output form'],
      supportingSignalCodes: issueSignalCodes(proceduralUtility, continuity)
    }));
  }

  if (hasViolationCode(telemetry, 'correction_ignored')) {
    issues.push(createIssueCandidate('correction_ignored', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.92,
      reasons: ['explicit user correction was not reflected in the final answer'],
      supportingSignalCodes: issueSignalCodes(continuity, proceduralUtility)
    }));
  }

  if (hasViolationCode(telemetry, 'mixed_domain_collapse')) {
    issues.push(createIssueCandidate('mixed_domain_collapse', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.9,
      reasons: ['mixed-domain request dropped one of the required domains in the final answer'],
      supportingSignalCodes: issueSignalCodes(continuity, specificity, proceduralUtility)
    }));
  }

  if (hasViolationCode(telemetry, 'followup_overask')) {
    issues.push(createIssueCandidate('followup_overask', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.86,
      reasons: ['answerable concierge request still asked an unnecessary follow-up question'],
      supportingSignalCodes: issueSignalCodes(proceduralUtility, continuity)
    }));
  }

  if (hasViolationCode(telemetry, 'internal_label_leak')) {
    issues.push(createIssueCandidate('internal_label_leak', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.96,
      reasons: ['internal routing or candidate labels leaked into the user-visible reply'],
      supportingSignalCodes: issueSignalCodes(naturalness)
    }));
  }

  if (hasViolationCode(telemetry, 'command_boundary_collision')) {
    issues.push(createIssueCandidate('command_boundary_collision', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.95,
      reasons: ['natural-language request collided with a command-only boundary and produced the wrong behavior'],
      supportingSignalCodes: issueSignalCodes(continuity, proceduralUtility)
    }));
  }

  if (hasViolationCode(telemetry, 'punctuation_anomaly')) {
    issues.push(createIssueCandidate('punctuation_anomaly', {
      slice,
      status: SIGNAL_STATUS.WARN,
      confidence: 0.82,
      reasons: ['reply punctuation quality degraded in a user-visible way'],
      supportingSignalCodes: issueSignalCodes(naturalness)
    }));
  }

  if (hasViolationCode(telemetry, 'parrot_echo')) {
    issues.push(createIssueCandidate('parrot_echo', {
      slice,
      status: SIGNAL_STATUS.FAIL,
      confidence: 0.91,
      reasons: ['reply repeated the prior assistant phrasing instead of moving the conversation forward'],
      supportingSignalCodes: issueSignalCodes(continuity, fallbackRepetition, naturalness)
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
