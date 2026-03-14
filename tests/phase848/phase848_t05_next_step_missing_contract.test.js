'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: next_step_missing is raised when reply stays abstract', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_next_step_missing',
    slice: 'housing',
    userMessage: { text: '賃貸契約で気をつける点は？', available: true },
    assistantReply: { text: 'ケースによります。一般的には契約内容を把握することが大切です。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'housing_answer',
      selectedCandidateKind: 'grounded_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      replyTemplateFingerprint: 'reply_fp_next_step_missing',
      repeatRiskScore: 0.08,
      directAnswerApplied: true,
      committedNextActions: []
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  });

  assert.ok(result.issueCandidates.some((item) => item.code === 'next_step_missing'));
  assert.equal(result.signals.proceduralUtility.status, 'fail');
});
