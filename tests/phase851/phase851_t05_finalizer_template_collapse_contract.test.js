'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext, buildTraceBundle } = require('./phase851_helpers');

test('phase851: finalizer template collapse is detected for repeated fallback fingerprints', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'repeatedTemplateResponseRate',
    category: 'repeated_template_response',
    issueType: 'fallback_repetition',
    slice: 'follow-up'
  });
  const context = buildReviewContext({
    slice: 'follow-up',
    telemetrySignals: {
      strategyReason: 'followup_support',
      selectedCandidateKind: 'generic_fallback',
      fallbackTemplateKind: 'generic_fallback_template',
      finalizerTemplateKind: 'generic_fallback_template',
      genericFallbackSlice: 'followup',
      priorContextUsed: true,
      followupResolvedFromHistory: true,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'followup_context_grounding_probe',
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_repeat',
      repeatRiskScore: 0.92,
      committedNextActions: ['次の手順を確認する']
    }
  });
  const traceBundles = [buildTraceBundle({
    traceId: 'trace_phase851_base',
    summary: {
      retrievalBlockReasons: [],
      retrievalPermitReasons: [],
      knowledgeRejectedReasons: [],
      cityPackRejectedReasons: [],
      savedFaqRejectedReasons: [],
      sourceReadinessDecisionSources: [],
      fallbackTemplateKinds: ['generic_fallback_template', 'generic_fallback_template'],
      finalizerTemplateKinds: ['generic_fallback_template', 'generic_fallback_template'],
      replyTemplateFingerprints: ['fp_repeat', 'fp_repeat']
    },
    traceJoinSummary: { completeness: 1 }
  })];

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('repeatedTemplateResponseRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles
  });

  assert.equal(result.rootCauseReports[0].causeCandidates[0].causeType, 'finalizer_template_collapse');
});
