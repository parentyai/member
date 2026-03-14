'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: knowledge activation missing is raised when grounded and saved FAQ candidates are unused', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_knowledge_activation_missing',
    slice: 'other',
    userMessage: { text: '会社設立のFAQで該当があるか知りたいです', available: true },
    assistantReply: { text: '一般的には必要書類を確認してください。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'faq_reuse_candidate_present',
      selectedCandidateKind: 'saved_faq_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: true,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_savedfaq_unused',
      repeatRiskScore: 0.1
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.ok(result.issueCandidates.some((item) => item.code === 'knowledge_activation_missing'));
  assert.ok(result.issueCandidates.some((item) => item.code === 'saved_faq_unused'));
  assert.equal(result.signals.knowledgeUse.status, 'fail');
});
