'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: KPI builder separates missing false blocked and unavailable counts', () => {
  const passEval = evaluate();
  const failEval = evaluate({
    reviewUnitId: 'review_unit_phase849_fail',
    slice: 'broad',
    userMessage: { text: 'アメリカ移住で何から始めればいい？', available: true },
    assistantReply: { text: '一般的には状況によります。まずは次の一手です。必要なら整理してください。', available: true },
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
      replyTemplateFingerprint: 'reply_fp_phase849_fail',
      repeatRiskScore: 0.75,
      directAnswerApplied: false,
      repetitionPrevented: false,
      committedNextActions: []
    }
  });
  const blockedEval = evaluate({
    reviewUnitId: 'review_unit_phase849_blocked',
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
      replyTemplateFingerprint: 'reply_fp_phase849_blocked',
      repeatRiskScore: null
    },
    observationBlockers: [
      { code: 'missing_user_message', severity: 'high', message: 'missing user message', source: 'conversation_review_units' },
      { code: 'missing_trace_evidence', severity: 'medium', message: 'missing trace evidence', source: 'conversation_review_units' },
      { code: 'transcript_not_reviewable', severity: 'high', message: 'transcript not reviewable', source: 'conversation_review_units' }
    ]
  });
  const unavailableEval = evaluate({
    reviewUnitId: 'review_unit_phase849_unavailable',
    telemetrySignals: {
      strategyReason: 'smalltalk',
      selectedCandidateKind: 'conversation_candidate',
      fallbackTemplateKind: 'casual_template',
      finalizerTemplateKind: 'casual_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: null,
      groundedCandidateAvailable: null,
      cityPackCandidateAvailable: null,
      cityPackUsedInAnswer: null,
      savedFaqCandidateAvailable: null,
      savedFaqUsedInAnswer: null,
      replyTemplateFingerprint: '',
      repeatRiskScore: null
    }
  });

  const result = buildPatrolKpis({
    reviewUnits: [passEval.reviewUnit, failEval.reviewUnit, blockedEval.reviewUnit, unavailableEval.reviewUnit],
    evaluations: [passEval.evaluation, failEval.evaluation, blockedEval.evaluation, unavailableEval.evaluation]
  });

  assert.equal(result.metrics.naturalness.sampleCount, 4);
  assert.equal(result.metrics.naturalness.falseCount, 0);
  assert.equal(result.metrics.specificity.blockedCount, 1);
  assert.equal(result.metrics.knowledgeUse.unavailableCount, 2);
});
