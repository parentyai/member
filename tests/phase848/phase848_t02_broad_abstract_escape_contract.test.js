'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: broad abstract escape is raised for generic broad fallback with low utility', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_broad_abstract',
    slice: 'broad',
    userMessage: { text: 'アメリカ移住で何から始めればいいですか？', available: true },
    assistantReply: { text: '一般的には状況によります。まずは次の一手です。必要なら情報を整理してください。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'broad_question',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'broad',
      priorContextUsed: null,
      followupResolvedFromHistory: null,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_broad_generic',
      repeatRiskScore: 0.68,
      directAnswerApplied: false,
      repetitionPrevented: false,
      committedNextActions: []
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.equal(result.status, 'fail');
  assert.ok(result.issueCandidates.some((item) => item.code === 'broad_abstract_escape'));
  assert.equal(result.signals.specificity.status, 'fail');
  assert.equal(result.signals.proceduralUtility.status, 'fail');
});
