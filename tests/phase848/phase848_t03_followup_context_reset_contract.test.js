'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: followup context reset is raised when prior context is available but not used', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_followup_reset',
    slice: 'follow-up',
    userMessage: { text: 'さっきの保育園の話で、締切はどこで確認できますか？', available: true },
    assistantReply: { text: '改めて状況を教えてください。一般論としては市役所に確認してください。', available: true },
    priorContextSummary: { text: '保育園申請の初回相談', available: true },
    telemetrySignals: {
      strategyReason: 'followup_context_expected',
      selectedCandidateKind: 'conversation_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      replyTemplateFingerprint: 'reply_fp_followup_reset',
      repeatRiskScore: 0.22,
      contextCarryScore: 0.1
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.ok(result.issueCandidates.some((item) => item.code === 'followup_context_reset'));
  assert.equal(result.signals.continuity.status, 'fail');
});
