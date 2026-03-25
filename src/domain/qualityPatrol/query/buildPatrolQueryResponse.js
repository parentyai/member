'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');
const { serializePatrolIssues } = require('./serializePatrolIssues');
const { serializePatrolEvidence } = require('./serializePatrolEvidence');
const { serializePatrolRecommendedPr } = require('./serializePatrolRecommendedPr');
const { serializePatrolObservationBlockers } = require('./serializePatrolObservationBlockers');
const { serializePatrolSummary } = require('./serializePatrolSummary');
const { buildTraceRefs } = require('./buildTraceRefs');
const {
  buildPatrolBacklogSeparation
} = require('./buildPatrolBacklogSeparation');

const QUERY_VERSION = 'quality_patrol_query_v1';

function resolveObservationStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.hasEvidence !== true) return 'insufficient_evidence';
  if (payload.observationBlockerCount > 0 || payload.planningStatus === 'blocked') return 'blocked';
  if (payload.planningStatus === 'insufficient_evidence') return 'insufficient_evidence';
  if (payload.kpiStatus === 'unavailable') return 'unavailable';
  return 'ready';
}

function buildEvidenceAvailability(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const backlogSeparation = payload.backlogSeparation && typeof payload.backlogSeparation === 'object'
    ? payload.backlogSeparation
    : {};
  const currentRuntime = backlogSeparation.currentRuntime && typeof backlogSeparation.currentRuntime === 'object'
    ? backlogSeparation.currentRuntime
    : {};
  const observedCount = Number(currentRuntime.observedCount || 0);
  const overallStatus = typeof summary.overallStatus === 'string' ? summary.overallStatus : 'unavailable';

  if (overallStatus === 'insufficient_evidence' && observedCount <= 0) {
    return {
      status: 'organic_current_runtime_unavailable',
      currentRuntimeStatus: typeof currentRuntime.status === 'string' ? currentRuntime.status : 'unavailable',
      currentRuntimeObservedCount: observedCount,
      summary: audience === 'human'
        ? '直近の自然な会話証跡がまだないため、改善提案は保留です。'
        : 'organic current runtime evidence is unavailable; waiting for fresh reviewable traffic before proposing changes.'
    };
  }

  if (overallStatus === 'insufficient_evidence') {
    return {
      status: 'insufficient_evidence',
      currentRuntimeStatus: typeof currentRuntime.status === 'string' ? currentRuntime.status : 'unavailable',
      currentRuntimeObservedCount: observedCount,
      summary: audience === 'human'
        ? '改善判断に必要な証跡がまだ足りません。'
        : 'evidence is still insufficient for a confident recommendation.'
    };
  }

  return {
    status: 'available',
    currentRuntimeStatus: typeof currentRuntime.status === 'string' ? currentRuntime.status : 'unavailable',
    currentRuntimeObservedCount: observedCount,
    summary: audience === 'human'
      ? '現在の証跡は参照可能です。'
      : 'current runtime evidence is available.'
  };
}

function buildPatrolQueryResponse(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const mode = typeof payload.mode === 'string' ? payload.mode : 'latest';
  const observationBlockers = serializePatrolObservationBlockers({
    audience,
    rootCauseReports: payload.rootCauseReports,
    planObservationBlockers: payload.planObservationBlockers,
    issues: payload.issues,
    recommendedPr: payload.recommendedPr,
    planningStatus: payload.planningStatus,
    transcriptCoverage: payload.transcriptCoverage,
    joinDiagnostics: payload.joinDiagnostics,
    reviewUnits: payload.reviewUnits
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
    decayAwareReadiness: payload.decayAwareReadiness,
    decayAwareOpsGate: payload.decayAwareOpsGate,
    issues: payload.issues,
    rootCauseReports: payload.rootCauseReports,
    joinDiagnostics: payload.joinDiagnostics
  });
  const traceRefs = buildTraceRefs({
    audience,
    reviewUnits: payload.reviewUnits,
    rootCauseReports: payload.rootCauseReports,
    issues: payload.issues
  });
  const backlogSeparation = buildPatrolBacklogSeparation({
    audience,
    decayAwareReadiness: payload.decayAwareReadiness,
    decayAwareOpsGate: payload.decayAwareOpsGate
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
  const evidenceAvailability = buildEvidenceAvailability({
    audience,
    summary,
    backlogSeparation
  });

  return {
    queryVersion: QUERY_VERSION,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    audience,
    summary,
    evidenceAvailability,
    issues,
    observationBlockers,
    evidence,
    backlogSeparation,
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
