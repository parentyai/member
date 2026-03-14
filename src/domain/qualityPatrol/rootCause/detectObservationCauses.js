'use strict';

const {
  ROOT_CAUSE_TYPE,
  TRANSCRIPT_AVAILABILITY_METRICS,
  CONTEXT_BLOCKER_CODES,
  UNAVAILABLE_BLOCKER_CODES,
  OBSERVATION_BLOCKER_METRICS
} = require('./constants');

function blockerCodes(blockers) {
  return new Set((Array.isArray(blockers) ? blockers : []).map((item) => item && item.code).filter(Boolean));
}

function hasAny(codes, expected) {
  return expected.some((item) => codes.has(item));
}

function baseEvidence(context) {
  return (Array.isArray(context.supportingEvidence) ? context.supportingEvidence : []).slice(0, 4);
}

function detectObservationCauses(context) {
  const issue = context && context.issue ? context.issue : {};
  const scopedMetric = context && context.scopedMetric ? context.scopedMetric : {};
  const blockers = Array.isArray(context && context.observationBlockers) ? context.observationBlockers : [];
  const codes = blockerCodes(blockers);
  const metricKey = issue.metricKey;
  const metricStatus = issue.metricStatus || scopedMetric.status || 'unavailable';
  const observationLike = issue.issueType === 'observation_blocker'
    || metricStatus === 'blocked'
    || metricStatus === 'unavailable'
    || blockers.length > 0
    || OBSERVATION_BLOCKER_METRICS.includes(metricKey)
    || TRANSCRIPT_AVAILABILITY_METRICS.includes(metricKey);

  if (!observationLike) return [];

  const out = [{
    causeType: ROOT_CAUSE_TYPE.observationGap,
    supportingSignals: ['observation_gap'],
    supportingEvidence: baseEvidence(context),
    evidenceGaps: context.evidenceGaps,
    upstreamLayer: 'detection',
    downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
  }];

  if (TRANSCRIPT_AVAILABILITY_METRICS.includes(metricKey) || hasAny(codes, UNAVAILABLE_BLOCKER_CODES)) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.transcriptUnavailable,
      supportingSignals: ['transcript_unavailable'],
      supportingEvidence: baseEvidence(context).concat(blockers.slice(0, 2)),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'transcript',
      downstreamImpact: ['review_unit_quality_judgement']
    });
  }

  if (blockers.length > 0) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.reviewUnitBlocked,
      supportingSignals: blockers.map((item) => item.code).filter(Boolean),
      supportingEvidence: blockers.slice(0, 3),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'transcript',
      downstreamImpact: ['review_unit_blocked']
    });
  }

  if (hasAny(codes, CONTEXT_BLOCKER_CODES)) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.blockedByMissingContext,
      supportingSignals: ['missing_context'],
      supportingEvidence: blockers.filter((item) => CONTEXT_BLOCKER_CODES.includes(item.code)).slice(0, 2),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'transcript',
      downstreamImpact: ['followup_analysis_limited']
    });
  }

  if (metricStatus === 'unavailable' || hasAny(codes, UNAVAILABLE_BLOCKER_CODES)) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.blockedByUnavailableData,
      supportingSignals: ['unavailable_data'],
      supportingEvidence: baseEvidence(context),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'kpi',
      downstreamImpact: ['cause_confidence_reduced']
    });
  }

  if (!context.runtimeSignals || (
    context.runtimeSignals.retrievalBlockedByStrategy !== true
    && context.runtimeSignals.groundedCandidateAvailable !== true
    && context.runtimeSignals.cityPackCandidateAvailable !== true
    && context.runtimeSignals.savedFaqCandidateAvailable !== true
    && context.runtimeSignals.readinessDecisions.length === 0
  )) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference,
      supportingSignals: ['observation_only'],
      supportingEvidence: baseEvidence(context),
      evidenceGaps: context.evidenceGaps.concat(['missing_runtime_telemetry']),
      upstreamLayer: 'detection',
      downstreamImpact: ['runtime_root_cause_not_inferred']
    });
  }

  if ((Array.isArray(context.supportingEvidence) ? context.supportingEvidence.length : 0) === 0 || context.evidenceGaps.length >= 2) {
    out.push({
      causeType: ROOT_CAUSE_TYPE.evidenceInsufficient,
      supportingSignals: ['evidence_insufficient'],
      supportingEvidence: baseEvidence(context),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'detection',
      downstreamImpact: ['analysis_confidence_low']
    });
  }

  return out;
}

module.exports = {
  detectObservationCauses
};
