'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: KPI builder returns metric envelopes, issue metrics, and summary shape', () => {
  const first = evaluate();
  const second = evaluate({
    reviewUnitId: 'review_unit_phase849_shape_2',
    slice: 'city',
    userMessage: { text: 'Seattleで子育てしやすいエリアは？', available: true },
    assistantReply: { text: 'まずBallardとBellevueを比較して、次に保育園の待機状況を確認してください。', available: true },
    telemetrySignals: {
      strategyReason: 'explicit_city_grounded_answer',
      selectedCandidateKind: 'city_pack_backed_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: true,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase849_shape_city',
      repeatRiskScore: 0.1,
      directAnswerApplied: true,
      repetitionPrevented: true,
      committedNextActions: ['エリア比較をする']
    }
  });

  const result = buildPatrolKpis({
    reviewUnits: [first.reviewUnit, second.reviewUnit],
    evaluations: [first.evaluation, second.evaluation]
  });

  assert.equal(result.provenance, 'review_unit_evaluator');
  assert.equal(result.summary.reviewUnitCount, 2);
  assert.ok(result.metrics.naturalness);
  assert.ok(result.metrics.reviewableTranscriptRate);
  assert.ok(result.issueCandidateMetrics.nextStepMissingRate);
  assert.ok(Array.isArray(result.metrics.naturalness.bySlice));
  assert.ok(Array.isArray(result.observationBlockers));
});
