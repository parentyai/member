'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: detection engine returns deterministic issue and backlog shapes', () => {
  const broad = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_shape',
    slice: 'broad',
    userMessage: { text: '移住で何から？', available: true },
    assistantReply: { text: '一般的には状況によります。まずは次の一手です。', available: true },
    telemetrySignals: {
      strategyReason: 'broad_question',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'broad',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase850_shape',
      repeatRiskScore: 0.82,
      committedNextActions: []
    }
  });

  const result = detectIssues({
    kpiResult: buildKpiResultFromEntries([broad])
  });

  assert.ok(Array.isArray(result.issueCandidates));
  assert.ok(result.issueCandidates.length >= 1);
  assert.equal(result.provenance, 'quality_patrol_detection');
  assert.ok(Array.isArray(result.backlogCandidates));
  assert.ok(result.issueCandidates[0].issueType);
  assert.ok(result.issueCandidates[0].issueKey);
  assert.ok(result.issueCandidates[0].recommendedBacklog);
});
