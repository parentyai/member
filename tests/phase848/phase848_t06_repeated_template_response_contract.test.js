'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: repeated template response is raised for high repetition-risk generic fallback', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_repeated_template',
    slice: 'broad',
    userMessage: { text: 'アメリカ移住でまず何を確認すべき？', available: true },
    assistantReply: { text: 'まずは次の一手です。必要なら追加情報を教えてください。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'broad_question',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'broad',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      replyTemplateFingerprint: 'reply_fp_repeat_broad',
      repeatRiskScore: 0.82,
      repetitionPrevented: false
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.ok(result.issueCandidates.some((item) => item.code === 'repeated_template_response'));
  assert.equal(result.signals.fallbackRepetition.status, 'fail');
});
