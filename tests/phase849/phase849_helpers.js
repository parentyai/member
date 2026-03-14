'use strict';

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

function buildReviewUnit(overrides) {
  return Object.assign({
    reviewUnitId: 'review_unit_phase849_base',
    slice: 'other',
    userMessage: { text: '保育園の申請で次に何をすればいいですか？', available: true },
    assistantReply: { text: 'まず必要書類を確認して、次に市役所の申請窓口へ連絡してください。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'procedural_support',
      selectedCandidateKind: 'grounded_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'grounded_answer_available',
      replyTemplateFingerprint: 'reply_fp_phase849_base',
      repeatRiskScore: 0.12,
      contextCarryScore: 0.5,
      directAnswerApplied: true,
      repetitionPrevented: true,
      conciseModeApplied: true,
      committedNextActions: ['必要書類を確認する'],
      committedFollowupQuestion: ''
    },
    observationBlockers: [],
    evidenceRefs: [],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {});
}

function evaluate(unitOverrides) {
  const reviewUnit = buildReviewUnit(unitOverrides);
  return {
    reviewUnit,
    evaluation: evaluateConversationQuality(reviewUnit)
  };
}

module.exports = {
  buildReviewUnit,
  evaluate
};
