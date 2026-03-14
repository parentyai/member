'use strict';

function buildMetric(status, overrides) {
  const bySliceRow = Object.assign({
    slice: 'city',
    value: status === 'fail' ? 0.3 : 0.9,
    sampleCount: 1,
    missingCount: 0,
    falseCount: status === 'fail' ? 1 : 0,
    blockedCount: 0,
    unavailableCount: 0,
    status
  }, overrides && overrides.bySliceRow ? overrides.bySliceRow : {});

  return Object.assign({
    value: status === 'fail' ? 0.3 : 0.9,
    sampleCount: 1,
    missingCount: 0,
    falseCount: status === 'fail' ? 1 : 0,
    blockedCount: 0,
    unavailableCount: 0,
    status,
    provenance: 'review_unit_evaluator',
    sourceCollections: ['conversation_review_snapshots'],
    observationBlockers: [],
    bySlice: [bySliceRow]
  }, overrides || {});
}

function buildIssueCandidate(overrides) {
  return Object.assign({
    issueType: 'specificity',
    issueKey: 'issue_city_specificity',
    title: 'City answers are missing specificity',
    summary: 'City replies stay generic even when city grounding is expected.',
    severity: 'high',
    status: 'open',
    confidence: 'high',
    metricKey: 'citySpecificityMissingRate',
    metricStatus: 'fail',
    layer: 'conversation',
    category: 'city_specificity_missing',
    slice: 'city',
    provenance: 'quality_patrol_detection',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
    observationBlockers: [],
    supportingSignals: ['cityPackCandidateAvailable', 'specificity_fail'],
    supportingEvidence: [
      { metric: 'citySpecificityMissingRate', summary: 'city slice metric failed', value: 0.3, sampleCount: 1 },
      { source: 'trace_bundle', traceId: 'trace-city-1', summary: 'completeness:1' }
    ],
    thresholds: { warn: 0.2, fail: 0.4, blocked: 1 },
    fingerprintInput: { scope: 'slice', category: 'city_specificity_missing', slice: 'city', layer: 'conversation', metricKey: 'citySpecificityMissingRate' }
  }, overrides || {});
}

function buildRootCauseReport(overrides) {
  return Object.assign({
    issueKey: 'issue_city_specificity',
    issueType: 'specificity',
    slice: 'city',
    rootCauseSummary: 'Most likely cause: City specificity gap',
    causeCandidates: [{
      causeType: 'city_specificity_gap',
      confidence: 'high',
      rank: 1,
      supportingSignals: ['cityPackCandidateAvailable', 'cityPackUsedInAnswer_false'],
      supportingEvidence: [
        { source: 'trace_bundle', traceId: 'trace-city-1', summary: 'completeness:1' }
      ],
      evidenceGaps: [],
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: ['citySpecificityMissingRate']
    }],
    observationBlockers: [],
    analysisStatus: 'analyzed',
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  }, overrides || {});
}

function buildRecommendedPr(overrides) {
  return Object.assign({
    proposalKey: 'proposal_city_specificity',
    proposalType: 'specificity_fix',
    priority: 'P1',
    title: 'City specificity grounding repair',
    objective: 'Increase city-specific grounding so city replies stop collapsing into generic guidance.',
    whyNow: 'issue_city_specificity now has a ranked root cause (city_specificity_gap) with evidence to support a focused repair.',
    whyNotOthers: 'Continuity or template changes do not create city-specific evidence.',
    rootCauseRefs: ['issue_city_specificity:city_specificity_gap'],
    targetFiles: ['src/domain/llm/knowledge/resolveCityIntentGrounding.js'],
    expectedImpact: ['specificity should improve'],
    riskLevel: 'medium',
    rollbackPlan: ['Revert the future specificity-fix PR if city grounding regressions appear.'],
    preconditions: [],
    blockedBy: [],
    confidence: 'high',
    provenance: 'quality_patrol_improvement_planner'
  }, overrides || {});
}

function buildFixture(overrides) {
  const reviewUnits = [{
    reviewUnitId: 'review_unit_1',
    traceId: 'trace-city-1',
    lineUserKey: 'lukey1',
    sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
    slice: 'city',
    userMessage: { text: '[masked]', available: true },
    assistantReply: { text: '[masked]', available: true },
    priorContextSummary: { text: null, available: false },
    telemetrySignals: {
      strategyReason: 'city_grounding_expected',
      selectedCandidateKind: 'knowledge',
      fallbackTemplateKind: 'none',
      finalizerTemplateKind: 'city_specificity_v1',
      genericFallbackSlice: '',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      cityPackUsedInAnswer: false,
      savedFaqUsedInAnswer: false
    },
    observationBlockers: [],
    evidenceRefs: [{ traceId: 'trace-city-1', kind: 'trace_bundle' }],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  }];

  const evaluations = [{
    reviewUnitId: 'review_unit_1',
    slice: 'city',
    status: 'fail',
    observationBlockers: [],
    signals: {
      naturalness: { value: 0.9, status: 'pass', supportingSignals: [] },
      continuity: { value: 0.8, status: 'pass', supportingSignals: [] },
      specificity: { value: 0.3, status: 'fail', supportingSignals: ['city_specificity_missing'] },
      proceduralUtility: { value: 0.7, status: 'warn', supportingSignals: ['next_step_weak'] },
      knowledgeUse: { value: 0.6, status: 'warn', supportingSignals: ['city_pack_unused'] },
      fallbackRepetition: { value: 0.1, status: 'pass', supportingSignals: [] }
    },
    issueCandidates: ['city_specificity_missing'],
    supportingEvidence: [{ source: 'trace_bundle', traceId: 'trace-city-1', summary: 'completeness:1' }],
    provenance: 'review_unit',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  }];

  const kpiResult = {
    summary: { overallStatus: 'fail', reviewUnitCount: 1, sliceCounts: { city: 1 } },
    metrics: {
      specificity: buildMetric('fail'),
      naturalness: buildMetric('pass'),
      continuity: buildMetric('pass'),
      proceduralUtility: buildMetric('warn', { value: 0.7, falseCount: 0, status: 'warn' }),
      knowledgeUse: buildMetric('warn', { value: 0.6, falseCount: 0, status: 'warn' }),
      fallbackRepetition: buildMetric('pass', { value: 0.1, falseCount: 0, status: 'pass' }),
      reviewableTranscriptRate: buildMetric('pass', { value: 1, falseCount: 0, status: 'pass' }),
      userMessageAvailableRate: buildMetric('pass', { value: 1, falseCount: 0, status: 'pass' }),
      assistantReplyAvailableRate: buildMetric('pass', { value: 1, falseCount: 0, status: 'pass' }),
      priorContextSummaryAvailableRate: buildMetric('warn', { value: 0, falseCount: 1, status: 'warn' }),
      transcriptAvailability: buildMetric('warn', { value: 0.66, falseCount: 1, status: 'warn' }),
      observationBlockerRate: buildMetric('pass', { value: 0, falseCount: 1, status: 'pass' }),
      blockedFollowupJudgementRate: buildMetric('pass', { value: 0, falseCount: 1, status: 'pass' }),
      blockedKnowledgeJudgementRate: buildMetric('pass', { value: 0, falseCount: 1, status: 'pass' })
    },
    issueCandidateMetrics: {
      citySpecificityMissingRate: buildMetric('fail')
    },
    observationBlockers: [],
    provenance: 'review_unit_evaluator',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  };

  const detectionResult = {
    summary: { issueCount: 1, blockedCount: 0, openCount: 1, watchingCount: 0, byType: { specificity: 1 }, bySlice: { city: 1 } },
    issueCandidates: [buildIssueCandidate()],
    backlogCandidates: [{
      backlogKey: 'backlog_city_specificity',
      title: 'City specificity grounding repair',
      priority: 'P1',
      objective: 'Increase city-specific grounding so city replies stop collapsing into generic guidance.',
      issueKeys: ['issue_city_specificity']
    }],
    provenance: 'quality_patrol_detection',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  };

  const rootCauseResult = {
    summary: { reportCount: 1, analyzedCount: 1, blockedCount: 0, insufficientEvidenceCount: 0, byAnalysisStatus: { analyzed: 1 }, byCauseType: { city_specificity_gap: 1 } },
    rootCauseReports: [buildRootCauseReport()],
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle'],
    detectionResult,
    kpiResult
  };

  const planResult = {
    ok: true,
    planVersion: 'quality_patrol_improvement_plan_v1',
    generatedAt: '2026-03-14T12:00:00.000Z',
    summary: { topPriorityCount: 1, observationOnlyCount: 0, runtimeFixCount: 1 },
    recommendedPr: [buildRecommendedPr()],
    observationBlockers: [],
    planningStatus: 'planned',
    provenance: 'quality_patrol_improvement_planner',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'trace_bundle']
  };

  return Object.assign({
    reviewUnits,
    evaluations,
    kpiResult,
    detectionResult,
    rootCauseResult,
    planResult,
    existingIssues: [],
    existingBacklog: []
  }, overrides || {});
}

module.exports = {
  buildMetric,
  buildIssueCandidate,
  buildRootCauseReport,
  buildRecommendedPr,
  buildFixture
};
