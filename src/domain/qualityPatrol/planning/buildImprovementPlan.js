'use strict';

const {
  IMPROVEMENT_PLAN_VERSION,
  IMPROVEMENT_PLANNER_PROVENANCE,
  OBSERVATION_PROPOSAL_TYPES
} = require('./constants');
const { buildRecommendedPr } = require('./buildRecommendedPr');
const { mapCauseToProposal } = require('./mapCauseToProposal');

function toIso(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function mergePlans(plans) {
  const grouped = new Map();
  (Array.isArray(plans) ? plans : []).forEach((plan) => {
    const key = plan.proposalType;
    if (!grouped.has(key)) {
      grouped.set(key, Object.assign({}, plan));
      return;
    }
    const current = grouped.get(key);
    current.rootCauseRefs = uniqueStrings(current.rootCauseRefs.concat(plan.rootCauseRefs));
    current.targetFiles = uniqueStrings(current.targetFiles.concat(plan.targetFiles));
    current.expectedImpact = uniqueStrings(current.expectedImpact.concat(plan.expectedImpact));
    current.rollbackPlan = uniqueStrings(current.rollbackPlan.concat(plan.rollbackPlan));
    current.preconditions = uniqueStrings(current.preconditions.concat(plan.preconditions));
    current.blockedBy = uniqueStrings(current.blockedBy.concat(plan.blockedBy));
    const confidenceRank = { low: 0, medium: 1, high: 2 };
    if (confidenceRank[plan.confidence] > confidenceRank[current.confidence]) current.confidence = plan.confidence;
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (priorityRank[plan.priority] < priorityRank[current.priority]) current.priority = plan.priority;
  });
  return Array.from(grouped.values()).sort((left, right) => {
    const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (priorityRank[left.priority] !== priorityRank[right.priority]) return priorityRank[left.priority] - priorityRank[right.priority];
    return left.title.localeCompare(right.title, 'ja');
  });
}

function isHistoricalOnlyObservationPlan(entry) {
  return entry
    && entry.report
    && entry.report.historicalOnly === true
    && entry.mapped
    && OBSERVATION_PROPOSAL_TYPES.includes(entry.mapped.proposalType);
}

function resolvePlanningStatus(reports, activeReports, proposals, context) {
  const sourceReports = Array.isArray(reports) ? reports : [];
  const activeSourceReports = Array.isArray(activeReports) ? activeReports : [];
  const payload = context && typeof context === 'object' ? context : {};
  const reviewUnitCount = Number(payload.reviewUnitCount || 0);
  const issueCount = Number(payload.issueCount || 0);
  const readinessStatus = normalizeText(payload.readinessStatus);
  if (!sourceReports.length) {
    if (reviewUnitCount > 0 && issueCount === 0 && readinessStatus === 'readiness_candidate') {
      return 'planned';
    }
    return 'insufficient_evidence';
  }
  if ((!Array.isArray(proposals) || proposals.length === 0)
    && activeSourceReports.length === 0) {
    return 'planned';
  }
  if (!Array.isArray(proposals) || proposals.length === 0) return 'insufficient_evidence';
  const allObservation = proposals.every((item) => OBSERVATION_PROPOSAL_TYPES.includes(item.proposalType));
  const allBlocked = activeSourceReports.every((item) => item.analysisStatus === 'blocked');
  const allInsufficient = activeSourceReports.every((item) => item.analysisStatus === 'insufficient_evidence');
  if (allBlocked || allObservation && activeSourceReports.some((item) => item.analysisStatus === 'blocked')) return 'blocked';
  if (allInsufficient) return 'insufficient_evidence';
  return 'planned';
}

function buildImprovementPlan(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const rootCauseReports = Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : [];
  const generatedAt = toIso(payload.generatedAt);
  const reportEntries = rootCauseReports.map((report) => {
    const topCause = Array.isArray(report && report.causeCandidates) ? report.causeCandidates[0] : null;
    if (!topCause) return {
      report,
      topCause: null,
      mapped: null
    };
    const mapped = mapCauseToProposal(report, topCause);
    return {
      report,
      topCause,
      mapped
    };
  });
  const activeEntries = reportEntries.filter((entry) => !isHistoricalOnlyObservationPlan(entry));
  const activeReports = activeEntries.map((entry) => entry.report);
  const observationBlockers = activeReports.flatMap((item) => Array.isArray(item && item.observationBlockers) ? item.observationBlockers : []);
  const recommendedPr = mergePlans(activeEntries.flatMap((entry) => {
    const report = entry && entry.report;
    const topCause = entry && entry.topCause;
    const mapped = entry && entry.mapped;
    if (!topCause || !mapped) return [];
    return [buildRecommendedPr({ report, cause: topCause, mapped })];
  }));

  return {
    planVersion: IMPROVEMENT_PLAN_VERSION,
    generatedAt,
    summary: {
      topPriorityCount: recommendedPr.filter((item) => ['P0', 'P1'].includes(item.priority)).length,
      observationOnlyCount: recommendedPr.filter((item) => OBSERVATION_PROPOSAL_TYPES.includes(item.proposalType)).length,
      runtimeFixCount: recommendedPr.filter((item) => !OBSERVATION_PROPOSAL_TYPES.includes(item.proposalType)).length
    },
    recommendedPr,
    observationBlockers,
    planningStatus: resolvePlanningStatus(rootCauseReports, activeReports, recommendedPr, {
      reviewUnitCount: payload.reviewUnitCount,
      issueCount: payload.issueCount,
      readinessStatus: payload.readinessStatus
    }),
    provenance: IMPROVEMENT_PLANNER_PROVENANCE
  };
}

module.exports = {
  buildImprovementPlan
};
