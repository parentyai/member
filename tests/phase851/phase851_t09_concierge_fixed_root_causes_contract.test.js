'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeRootCauses } = require('../../src/domain/qualityPatrol/analyzeRootCauses');
const { buildDetectionResult, buildKpiResult, buildReviewContext } = require('./phase851_helpers');

test('phase851: correction ignored maps to context override root cause', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'correctionIgnoredRate',
    category: 'correction_ignored',
    issueCode: 'QP_CORRECTION_IGNORED',
    issueType: 'conversation_quality',
    slice: 'follow-up'
  });
  const context = buildReviewContext({
    slice: 'follow-up',
    priorContextSummary: { text: '学校手続きの流れを案内していた', available: true },
    telemetrySignals: {
      strategyReason: 'followup_support',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: true,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      retrievalBlockedByStrategy: false,
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_context_override',
      repeatRiskScore: 0.2,
      violationCodes: ['correction_ignored']
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('correctionIgnoredRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  assert.equal(result.rootCauseReports[0].causeCandidates[0].causeType, 'context_override');
});

test('phase851: command boundary collisions map to command boundary misfire root cause', () => {
  const detectionResult = buildDetectionResult({
    metricKey: 'commandBoundaryCollisionRate',
    category: 'command_boundary_collision',
    issueCode: 'QP_COMMAND_BOUNDARY_COLLISION',
    issueType: 'conversation_quality',
    slice: 'other'
  });
  const context = buildReviewContext({
    slice: 'other',
    telemetrySignals: {
      strategyReason: 'criteria_only',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      retrievalBlockedByStrategy: false,
      readinessDecision: 'allow',
      replyTemplateFingerprint: 'fp_command_boundary_misfire',
      repeatRiskScore: 0.12,
      violationCodes: ['command_boundary_collision']
    }
  });

  const result = analyzeRootCauses({
    detectionResult,
    kpiResult: buildKpiResult('commandBoundaryCollisionRate'),
    reviewUnits: context.reviewUnits,
    evaluations: [],
    traceBundles: context.traceBundles
  });

  assert.equal(result.rootCauseReports[0].causeCandidates[0].causeType, 'command_boundary_misfire');
});
