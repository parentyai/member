'use strict';

const { collectCauseEvidence } = require('./collectCauseEvidence');
const { resolveCauseConfidence } = require('./resolveCauseConfidence');
const { detectObservationCauses } = require('./detectObservationCauses');
const { detectRetrievalCauses } = require('./detectRetrievalCauses');
const { detectKnowledgeSelectionCauses } = require('./detectKnowledgeSelectionCauses');
const { detectReadinessCauses } = require('./detectReadinessCauses');
const { detectFinalizerTemplateCauses } = require('./detectFinalizerTemplateCauses');
const { detectContinuityCauses } = require('./detectContinuityCauses');
const { detectSpecificityCauses } = require('./detectSpecificityCauses');
const { detectConciergeCauses } = require('./detectConciergeCauses');
const { detectFixedRootCauseCauses } = require('./detectFixedRootCauseCauses');
const {
  ROOT_CAUSE_PROVENANCE,
  ROOT_CAUSE_ANALYSIS_STATUS,
  ROOT_CAUSE_TYPE,
  ROOT_CAUSE_LABELS,
  CAUSE_PRIORITY
} = require('./constants');

function dedupeCandidates(candidates) {
  const out = [];
  const seen = new Set();
  (Array.isArray(candidates) ? candidates : []).forEach((item) => {
    if (!item || !item.causeType) return;
    const key = JSON.stringify([item.causeType, item.upstreamLayer || '', item.supportingSignals || []]);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function causePriority(type) {
  const index = CAUSE_PRIORITY.indexOf(type);
  return index >= 0 ? index : CAUSE_PRIORITY.length + 1;
}

function hasObservationLead(candidates) {
  const first = Array.isArray(candidates) && candidates[0] ? candidates[0].causeType : null;
  return [
    ROOT_CAUSE_TYPE.observationGap,
    ROOT_CAUSE_TYPE.transcriptUnavailable,
    ROOT_CAUSE_TYPE.reviewUnitBlocked,
    ROOT_CAUSE_TYPE.blockedByMissingContext,
    ROOT_CAUSE_TYPE.blockedByUnavailableData,
    ROOT_CAUSE_TYPE.observationOnlyNoRuntimeInference
  ].includes(first);
}

function analyzeStatus(issue, candidates, context) {
  const historicalOnly = issue && issue.historicalOnly === true;
  if (!Array.isArray(candidates) || candidates.length === 0) return ROOT_CAUSE_ANALYSIS_STATUS.insufficientEvidence;
  if (issue && issue.issueType === 'observation_blocker' && historicalOnly !== true) return ROOT_CAUSE_ANALYSIS_STATUS.blocked;
  if (
    historicalOnly !== true
    && hasObservationLead(candidates)
    && Array.isArray(context.observationBlockers)
    && context.observationBlockers.length > 0
  ) {
    return ROOT_CAUSE_ANALYSIS_STATUS.blocked;
  }
  if (candidates.every((item) => item.causeType === ROOT_CAUSE_TYPE.evidenceInsufficient)) {
    return ROOT_CAUSE_ANALYSIS_STATUS.insufficientEvidence;
  }
  return ROOT_CAUSE_ANALYSIS_STATUS.analyzed;
}

function normalizeCandidate(candidate, rank, analysisStatus, blockers) {
  const supportingEvidence = Array.isArray(candidate.supportingEvidence) ? candidate.supportingEvidence.slice(0, 6) : [];
  const evidenceGaps = Array.from(new Set((Array.isArray(candidate.evidenceGaps) ? candidate.evidenceGaps : []).filter(Boolean)));
  return {
    causeType: candidate.causeType,
    confidence: candidate.confidence || resolveCauseConfidence({
      supportingEvidence,
      evidenceGaps,
      observationBlockers: blockers,
      analysisStatus
    }),
    rank,
    supportingSignals: Array.from(new Set((Array.isArray(candidate.supportingSignals) ? candidate.supportingSignals : []).filter(Boolean))),
    supportingEvidence,
    evidenceGaps,
    upstreamLayer: candidate.upstreamLayer || 'detection',
    downstreamImpact: Array.from(new Set((Array.isArray(candidate.downstreamImpact) ? candidate.downstreamImpact : []).filter(Boolean)))
  };
}

function buildRootCauseSummary(issue, candidates, analysisStatus) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return `No confident root cause found for ${issue.issueKey || issue.metricKey || 'issue'}.`;
  }
  const label = ROOT_CAUSE_LABELS[candidates[0].causeType] || candidates[0].causeType;
  if (analysisStatus === ROOT_CAUSE_ANALYSIS_STATUS.blocked) return `Analysis blocked: ${label}`;
  if (analysisStatus === ROOT_CAUSE_ANALYSIS_STATUS.insufficientEvidence) return `Insufficient evidence: ${label}`;
  return `Most likely cause: ${label}`;
}

function buildRootCauseReport(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const issue = payload.issue && typeof payload.issue === 'object' ? payload.issue : {};
  const context = collectCauseEvidence(payload);
  const observationCandidates = detectObservationCauses(context);
  let runtimeCandidates = [];
  if (!(issue.issueType === 'observation_blocker' && observationCandidates.length > 0)) {
    runtimeCandidates = []
      .concat(detectFixedRootCauseCauses(context))
      .concat(detectConciergeCauses(context))
      .concat(detectRetrievalCauses(context))
      .concat(detectKnowledgeSelectionCauses(context))
      .concat(detectReadinessCauses(context))
      .concat(detectFinalizerTemplateCauses(context))
      .concat(detectContinuityCauses(context))
      .concat(detectSpecificityCauses(context));
  }

  let candidates = dedupeCandidates(observationCandidates.concat(runtimeCandidates))
    .sort((left, right) => causePriority(left.causeType) - causePriority(right.causeType));

  if (candidates.length === 0) {
    candidates = [{
      causeType: ROOT_CAUSE_TYPE.evidenceInsufficient,
      supportingSignals: ['evidence_insufficient'],
      supportingEvidence: context.supportingEvidence.slice(0, 4),
      evidenceGaps: context.evidenceGaps,
      upstreamLayer: 'detection',
      downstreamImpact: [issue.category || issue.metricKey].filter(Boolean)
    }];
  }

  const analysisStatus = analyzeStatus(issue, candidates, context);
  const normalizedCandidates = candidates.map((candidate, index) => normalizeCandidate(candidate, index + 1, analysisStatus, context.observationBlockers));

  return {
    issueKey: issue.issueKey || null,
    issueType: issue.issueType || null,
    slice: issue.slice || 'global',
    rootCauseSummary: buildRootCauseSummary(issue, normalizedCandidates, analysisStatus),
    causeCandidates: normalizedCandidates,
    observationBlockers: context.observationBlockers,
    analysisStatus,
    provenance: ROOT_CAUSE_PROVENANCE,
    sourceCollections: context.sourceCollections
  };
}

module.exports = {
  buildRootCauseReport
};
