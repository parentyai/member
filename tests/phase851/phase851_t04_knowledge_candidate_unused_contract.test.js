'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: knowledge candidate unused is detected when grounded candidates were available but not used', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'savedFaqUnusedRate',
    category: 'saved_faq_unused',
    issueType: 'knowledge_activation'
  });
  const context = buildReviewContext({
    telemetrySignals: {
      strategyReason: 'faq_support',
      selectedCandidateKind: 'generic_fallback',
      fallbackTemplateKind: 'generic_fallback_template',
      finalizerTemplateKind: 'generic_fallback_template',
      genericFallbackSlice: 'other',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: true,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'grounded_answer_available',
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_saved_faq_unused',
      repeatRiskScore: 0.2,
      committedNextActions: ['候補を比べる']
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('savedFaqUnusedRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  const causeTypes = result.rootCauseReports[0].causeCandidates.map((item) => item.causeType);
  assert.ok(causeTypes.includes('knowledge_candidate_unused'));
  assert.ok(causeTypes.includes('fallback_selected_over_grounded'));
});
