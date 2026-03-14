'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: followup context loss is detected when prior context is not carried', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'followupContextResetRate',
    category: 'followup_context_reset',
    issueType: 'continuity',
    slice: 'follow-up'
  });
  const context = buildReviewContext({
    slice: 'follow-up',
    priorContextSummary: { text: '住民票の転入届について相談中', available: true },
    telemetrySignals: {
      strategyReason: 'followup_support',
      selectedCandidateKind: 'grounded_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'followup_context_grounding_probe',
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_followup_context_loss',
      repeatRiskScore: 0.2,
      committedNextActions: ['必要書類を再確認する']
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('followupContextResetRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  assert.equal(result.rootCauseReports[0].causeCandidates[0].causeType, 'followup_context_loss');
});
