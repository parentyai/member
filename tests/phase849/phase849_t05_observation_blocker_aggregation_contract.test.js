'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: observation blockers are aggregated at top-level and metric level', () => {
  const blockedFollowup = evaluate({
    reviewUnitId: 'review_unit_phase849_blocker_followup',
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
      replyTemplateFingerprint: 'reply_fp_phase849_blocker_followup'
    },
    observationBlockers: [
      { code: 'missing_user_message', severity: 'high', message: 'missing user message', source: 'conversation_review_units' },
      { code: 'missing_trace_evidence', severity: 'medium', message: 'missing trace evidence', source: 'conversation_review_units' },
      { code: 'transcript_not_reviewable', severity: 'high', message: 'transcript not reviewable', source: 'conversation_review_units' }
    ]
  });

  const result = buildPatrolKpis({
    reviewUnits: [blockedFollowup.reviewUnit],
    evaluations: [blockedFollowup.evaluation]
  });

  assert.ok(result.observationBlockers.some((item) => item.code === 'missing_user_message'));
  assert.ok(result.observationBlockers.some((item) => item.code === 'insufficient_context_for_followup_judgement'));
  assert.equal(result.metrics.observationBlockerRate.value, 1);
  assert.equal(result.metrics.blockedFollowupJudgementRate.value, 1);
});
