'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: detector emits slice-first issues for broad and city slices', () => {
  const broad = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_broad',
    slice: 'broad',
    userMessage: { text: '移住で何から？', available: true },
    assistantReply: { text: '一般的には状況によります。', available: true },
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
      replyTemplateFingerprint: 'reply_fp_phase850_broad',
      repeatRiskScore: 0.73,
      committedNextActions: []
    }
  });
  const city = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_city',
    slice: 'city',
    userMessage: { text: 'Seattleで子育てしやすいエリアは？', available: true },
    assistantReply: { text: 'Seattleはいくつか候補があります。', available: true },
    telemetrySignals: {
      strategyReason: 'explicit_city_grounded_answer',
      selectedCandidateKind: 'city_pack_backed_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase850_city',
      repeatRiskScore: 0.12
    }
  });

  const result = detectIssues({
    kpiResult: buildKpiResultFromEntries([broad, city])
  });

  assert.ok(result.issueCandidates.some((item) => item.slice === 'broad'));
  assert.ok(result.issueCandidates.some((item) => item.slice === 'city'));
});
