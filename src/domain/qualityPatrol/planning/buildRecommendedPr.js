'use strict';

const {
  IMPROVEMENT_PLANNER_PROVENANCE,
  PROPOSAL_TYPE,
  TARGET_FILE_MAP,
  EXPECTED_IMPACT_MAP,
  buildProposalKey
} = require('./constants');
const { resolvePlanningPriority } = require('./resolvePlanningPriority');
const { resolvePlanningRisk } = require('./resolvePlanningRisk');
const { resolveRollbackPlan } = require('./resolveRollbackPlan');

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function buildWhyNow(report, cause, proposalType) {
  const issueKey = report && report.issueKey ? report.issueKey : 'issue';
  const summary = report && report.rootCauseSummary ? report.rootCauseSummary : 'Root cause analysis is available.';
  if ([PROPOSAL_TYPE.observationOnly, PROPOSAL_TYPE.sampleCollection, PROPOSAL_TYPE.transcriptCoverageRepair, PROPOSAL_TYPE.blockedByObservationGap, PROPOSAL_TYPE.noActionUntilEvidence].includes(proposalType)) {
    return `${issueKey} is still blocked by observation gaps. ${summary}`;
  }
  return `${issueKey} now has a ranked root cause (${cause.causeType}) with evidence to support a focused repair.`;
}

function buildPreconditions(report, cause) {
  const out = [];
  if (report && report.analysisStatus !== 'analyzed') out.push(`analysis_status:${report.analysisStatus}`);
  if (cause && cause.confidence === 'low') out.push('collect_additional_evidence_before_implementation');
  if (Array.isArray(cause && cause.evidenceGaps) && cause.evidenceGaps.length > 0) {
    cause.evidenceGaps.slice(0, 4).forEach((item) => out.push(`evidence_gap:${item}`));
  }
  return uniqueStrings(out);
}

function buildBlockedBy(report, cause) {
  const blockers = []
    .concat(Array.isArray(report && report.observationBlockers) ? report.observationBlockers.map((item) => item && item.code).filter(Boolean) : [])
    .concat(Array.isArray(cause && cause.evidenceGaps) ? cause.evidenceGaps.filter(Boolean) : []);
  return uniqueStrings(blockers);
}

function buildRecommendedPr(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const report = payload.report || {};
  const cause = payload.cause || {};
  const mapped = payload.mapped || {};
  const proposalType = mapped.proposalType || PROPOSAL_TYPE.observationOnly;
  const blockedBy = buildBlockedBy(report, cause);
  const preconditions = buildPreconditions(report, cause);
  const confidence = cause.confidence || 'medium';
  const targetFiles = (TARGET_FILE_MAP[proposalType] || []).slice();
  const proposalKey = buildProposalKey([
    proposalType,
    mapped.title,
    cause.causeType,
    targetFiles.join('|')
  ].join('|'));

  return {
    proposalKey,
    proposalType,
    priority: resolvePlanningPriority({
      proposalType,
      confidence,
      analysisStatus: mapped.planningStatus
    }),
    title: mapped.title,
    objective: mapped.objective,
    whyNow: buildWhyNow(report, cause, proposalType),
    whyNotOthers: mapped.whyNotOthers,
    rootCauseRefs: uniqueStrings([report.issueKey ? `${report.issueKey}:${cause.causeType}` : cause.causeType]),
    targetFiles,
    expectedImpact: (EXPECTED_IMPACT_MAP[proposalType] || []).slice(),
    riskLevel: resolvePlanningRisk({ proposalType, confidence, blockedBy }),
    rollbackPlan: resolveRollbackPlan({ proposalType }),
    preconditions,
    blockedBy,
    confidence,
    provenance: IMPROVEMENT_PLANNER_PROVENANCE
  };
}

module.exports = {
  buildRecommendedPr
};
