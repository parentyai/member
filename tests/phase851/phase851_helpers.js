'use strict';

const { buildReviewUnit } = require('../phase849/phase849_helpers');
const { buildMetricEnvelope, buildManualKpiResult } = require('../phase850/phase850_helpers');

function buildIssueCandidate(overrides) {
  return Object.assign({
    issueKey: 'issue_phase851_base',
    issueType: 'conversation_quality',
    category: 'knowledge_activation_missing',
    metricKey: 'knowledgeActivationMissingRate',
    metricStatus: 'fail',
    slice: 'other',
    severity: 'medium',
    status: 'open',
    confidence: 'medium',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
    observationBlockers: [],
    supportingSignals: ['knowledge_activation_missing'],
    supportingEvidence: [{ metric: 'knowledgeActivationMissingRate', status: 'fail', value: 0.9, sampleCount: 3, slice: 'other' }]
  }, overrides || {});
}

function buildDetectionResult(issueOverrides) {
  return {
    summary: { issueCount: 1, blockedCount: 0, openCount: 1, watchingCount: 0, byType: { conversation_quality: 1 }, bySlice: { other: 1 } },
    issueCandidates: [buildIssueCandidate(issueOverrides)],
    backlogCandidates: [],
    provenance: 'quality_patrol_detection',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function buildKpiResult(metricKey, overrides) {
  const kpi = buildManualKpiResult();
  const envelope = buildMetricEnvelope(Object.assign({
    value: 0.35,
    sampleCount: 3,
    falseCount: 2,
    status: 'fail',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {}), {
    other: Object.assign({
      value: 0.35,
      sampleCount: 3,
      falseCount: 2,
      status: 'fail'
    }, overrides || {})
  });

  if (kpi.metrics[metricKey]) kpi.metrics[metricKey] = envelope;
  else if (kpi.issueCandidateMetrics[metricKey]) kpi.issueCandidateMetrics[metricKey] = envelope;
  return kpi;
}

function buildTraceBundle(overrides) {
  return Object.assign({
    ok: true,
    traceId: 'trace_phase851_base',
    summary: {
      retrievalBlockReasons: [],
      retrievalPermitReasons: [],
      knowledgeRejectedReasons: [],
      cityPackRejectedReasons: [],
      savedFaqRejectedReasons: [],
      sourceReadinessDecisionSources: [],
      fallbackTemplateKinds: [],
      finalizerTemplateKinds: [],
      replyTemplateFingerprints: []
    },
    traceJoinSummary: {
      completeness: 1
    }
  }, overrides || {});
}

function buildReviewContext(overrides) {
  const reviewUnit = buildReviewUnit(Object.assign({
    reviewUnitId: 'review_unit_phase851_base',
    evidenceRefs: [{ source: 'trace_bundle', kind: 'trace_join_summary', traceId: 'trace_phase851_base', refId: 'trace_phase851_base', createdAt: null, summary: 'completeness:1' }]
  }, overrides || {}));
  return {
    reviewUnits: [reviewUnit],
    evaluations: [],
    traceBundles: [buildTraceBundle()]
  };
}

module.exports = {
  buildIssueCandidate,
  buildDetectionResult,
  buildKpiResult,
  buildTraceBundle,
  buildReviewContext
};
