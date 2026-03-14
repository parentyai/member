'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');

test('phase848: blocked and unavailable signals remain separated', () => {
  const result = evaluateConversationQuality({
    reviewUnitId: 'review_unit_missing_vs_blocked',
    slice: 'follow-up',
    userMessage: { text: '', available: false },
    assistantReply: { text: 'まず役所へ確認してください。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'followup_context_expected',
      selectedCandidateKind: 'conversation_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: null,
      groundedCandidateAvailable: null,
      cityPackCandidateAvailable: null,
      cityPackUsedInAnswer: null,
      savedFaqCandidateAvailable: null,
      savedFaqUsedInAnswer: null,
      replyTemplateFingerprint: 'reply_fp_missing_vs_blocked',
      repeatRiskScore: null
    },
    observationBlockers: [
      { code: 'missing_user_message', severity: 'high', message: 'missing user message', source: 'conversation_review_units' },
      { code: 'missing_trace_evidence', severity: 'medium', message: 'missing trace evidence', source: 'conversation_review_units' },
      { code: 'transcript_not_reviewable', severity: 'high', message: 'transcript not reviewable', source: 'conversation_review_units' }
    ],
    evidenceRefs: [],
    sourceCollections: ['llm_action_logs']
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.signals.specificity.status, 'blocked');
  assert.equal(result.signals.knowledgeUse.status, 'unavailable');
  assert.ok(result.observationBlockers.some((item) => item.code === 'insufficient_context_for_followup_judgement'));
  assert.ok(result.observationBlockers.some((item) => item.code === 'insufficient_trace_evidence'));
});
