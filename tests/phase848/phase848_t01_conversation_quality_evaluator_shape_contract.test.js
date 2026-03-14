'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

function buildBaseReviewUnit(overrides) {
  return Object.assign({
    reviewUnitId: 'review_unit_phase848_base',
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
      priorContextUsed: null,
      followupResolvedFromHistory: null,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: null,
      cityPackUsedInAnswer: null,
      savedFaqCandidateAvailable: null,
      savedFaqUsedInAnswer: null,
      retrievalBlockedByStrategy: false,
      retrievalPermitReason: 'grounded_answer_available',
      replyTemplateFingerprint: 'reply_fp_phase848_shape',
      repeatRiskScore: 0.12,
      contextCarryScore: null,
      directAnswerApplied: true,
      repetitionPrevented: true,
      conciseModeApplied: true,
      committedNextActions: ['必要書類を確認する'],
      committedFollowupQuestion: ''
    },
    observationBlockers: [],
    evidenceRefs: [{ source: 'conversation_review_snapshots', kind: 'masked_transcript_snapshot', refId: 'snapshot_1', traceId: 'trace_shape', createdAt: '2026-03-14T18:00:00.000Z', summary: 'user/assistant' }],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {});
}

test('phase848: conversation quality evaluator returns deterministic shape', () => {
  const result = evaluateConversationQuality(buildBaseReviewUnit());
  assert.equal(result.reviewUnitId, 'review_unit_phase848_base');
  assert.equal(result.provenance, 'review_unit');
  assert.ok(['pass', 'warn', 'fail', 'blocked'].includes(result.status));
  assert.ok(Array.isArray(result.observationBlockers));
  assert.ok(Array.isArray(result.issueCandidates));
  assert.ok(Array.isArray(result.supportingEvidence));
  assert.equal(typeof result.signals.naturalness.value, 'number');
  assert.ok(['pass', 'warn', 'fail', 'blocked', 'unavailable'].includes(result.signals.specificity.status));
  assert.ok(result.sourceCollections.includes('conversation_review_snapshots'));
});
