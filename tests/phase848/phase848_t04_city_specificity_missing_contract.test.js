'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: city specificity missing is raised when city pack is available but unused', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_city_specificity_missing',
    slice: 'city',
    userMessage: { text: 'Seattleで子育てしやすいエリアはどこですか？', available: true },
    assistantReply: { text: '一般的には通いやすさと家賃を見て決めるとよいです。', available: true },
    priorContextSummary: { text: '', available: false },
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
      knowledgeGroundingKind: 'city_pack',
      replyTemplateFingerprint: 'reply_fp_city_unused',
      repeatRiskScore: 0.12
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.ok(result.issueCandidates.some((item) => item.code === 'city_specificity_missing'));
  assert.ok(result.issueCandidates.some((item) => item.code === 'city_pack_unused'));
  assert.equal(result.signals.specificity.status, 'fail');
});
