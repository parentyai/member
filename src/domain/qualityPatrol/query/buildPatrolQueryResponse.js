'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');
const { serializePatrolIssues } = require('./serializePatrolIssues');
const { serializePatrolEvidence } = require('./serializePatrolEvidence');
const { serializePatrolRecommendedPr } = require('./serializePatrolRecommendedPr');
const { serializePatrolObservationBlockers } = require('./serializePatrolObservationBlockers');
const { serializePatrolSummary } = require('./serializePatrolSummary');
const { buildTraceRefs } = require('./buildTraceRefs');

const QUERY_VERSION = 'quality_patrol_query_v1';

function resolveObservationStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.hasEvidence !== true) return 'insufficient_evidence';
  if (payload.observationBlockerCount > 0 || payload.planningStatus === 'blocked') return 'blocked';
  if (payload.planningStatus === 'insufficient_evidence') return 'insufficient_evidence';
  if (payload.kpiStatus === 'unavailable') return 'unavailable';
  return 'ready';
}

function buildPatrolQueryResponse(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const mode = typeof payload.mode === 'string' ? payload.mode : 'latest';
  const observationBlockers = serializePatrolObservationBlockers({
    audience,
    rootCauseReports: payload.rootCauseReports,
    planObservationBlockers: payload.planObservationBlockers,
    issues: payload.issues
  });
  const issues = serializePatrolIssues({
    audience,
    mode,
    issues: payload.issues,
    existingIssues: payload.existingIssues,
    observationBlockers
  });
  const recommendedPr = serializePatrolRecommendedPr({
    audience,
    mode,
    recommendedPr: payload.recommendedPr,
    existingBacklog: payload.existingBacklog,
    observationBlockers
  });
  const evidence = serializePatrolEvidence({
    audience,
    metrics: payload.metrics,
    transcriptCoverage: payload.transcriptCoverage,
    issues: payload.issues,
    rootCauseReports: payload.rootCauseReports
  });
  const traceRefs = buildTraceRefs({
    audience,
    reviewUnits: payload.reviewUnits,
    rootCauseReports: payload.rootCauseReports,
    issues: payload.issues
  });
  const topPriorityCount = recommendedPr.filter((item) => item.priority === 'P0' || item.priority === 'P1').length;
  const hasEvidence = (Array.isArray(payload.reviewUnits) && payload.reviewUnits.length > 0)
    || (Array.isArray(payload.issues) && payload.issues.length > 0)
    || observationBlockers.length > 0
    || recommendedPr.length > 0;
  const summary = serializePatrolSummary({
    audience,
    mode,
    issues,
    recommendedPr,
    observationBlockers,
    kpiStatus: payload.kpiSummary && payload.kpiSummary.overallStatus ? payload.kpiSummary.overallStatus : 'unavailable',
    planningStatus: payload.planningStatus,
    hasEvidence,
    hasSevereIssue: issues.some((item) => item.severity === 'critical' || item.severity === 'high'),
    issueCount: issues.length,
    recommendedPrCount: recommendedPr.length,
    topPriorityCount,
    observationBlockerCount: observationBlockers.length
  });

  return {
    queryVersion: QUERY_VERSION,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    audience,
    summary,
    issues,
    observationBlockers,
    evidence,
    traceRefs,
    recommendedPr,
    observationStatus: resolveObservationStatus({
      hasEvidence,
      observationBlockerCount: observationBlockers.length,
      planningStatus: payload.planningStatus,
      kpiStatus: payload.kpiSummary && payload.kpiSummary.overallStatus ? payload.kpiSummary.overallStatus : 'unavailable'
    }),
    provenance: 'quality_patrol_query',
    sourceCollections: Array.from(new Set((Array.isArray(payload.sourceCollections) ? payload.sourceCollections : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'))
  };
}

module.exports = {
  QUERY_VERSION,
  buildPatrolQueryResponse
};
