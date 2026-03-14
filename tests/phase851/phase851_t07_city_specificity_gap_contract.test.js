'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: city specificity gap is detected for city slice specificity failures', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'citySpecificityMissingRate',
    category: 'city_specificity_missing',
    issueType: 'specificity',
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
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'city_grounding_probe',
      knowledgeGroundingKind: 'city',
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_city_specificity',
      repeatRiskScore: 0.2,
      committedNextActions: []
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('citySpecificityMissingRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  const causeTypes = result.rootCauseReports[0].causeCandidates.map((item) => item.causeType);
  assert.ok(causeTypes.includes('city_specificity_gap'));
});
