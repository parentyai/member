'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: knowledge candidate missing is detected when knowledge candidates were not available', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'knowledgeActivationMissingRate',
    category: 'knowledge_activation_missing',
    issueType: 'knowledge_activation',
    slice: 'city'
  });
  const context = buildReviewContext({
    slice: 'city',
    telemetrySignals: {
      strategyReason: 'city_support',
      selectedCandidateKind: 'generic_fallback',
      fallbackTemplateKind: 'generic_fallback_template',
      finalizerTemplateKind: 'generic_fallback_template',
      genericFallbackSlice: 'city',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'city_grounding_probe',
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_city_missing',
      repeatRiskScore: 0.2,
      committedNextActions: []
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('knowledgeActivationMissingRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  assert.equal(result.rootCauseReports[0].causeCandidates[0].causeType, 'knowledge_candidate_missing');
});
