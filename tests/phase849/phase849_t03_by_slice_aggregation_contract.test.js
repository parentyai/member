'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: KPI builder aggregates metrics by slice', () => {
  const broad = evaluate({
    reviewUnitId: 'review_unit_phase849_broad',
    slice: 'broad',
    userMessage: { text: '移住で何から？', available: true },
    assistantReply: { text: '一般的には状況によります。', available: true },
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
      replyTemplateFingerprint: 'reply_fp_phase849_broad',
      repeatRiskScore: 0.7
    }
  });
  const city = evaluate({
    reviewUnitId: 'review_unit_phase849_city',
    slice: 'city',
    userMessage: { text: 'Seattleで子育てしやすいエリアは？', available: true },
    assistantReply: { text: 'まずBallardとBellevueを比較してください。', available: true },
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
      replyTemplateFingerprint: 'reply_fp_phase849_city',
      repeatRiskScore: 0.08
    }
  });

  const result = buildPatrolKpis({
    reviewUnits: [broad.reviewUnit, city.reviewUnit],
    evaluations: [broad.evaluation, city.evaluation]
  });

  const specificityBySlice = Object.fromEntries(result.metrics.specificity.bySlice.map((row) => [row.slice, row]));
  assert.equal(specificityBySlice.broad.sampleCount, 1);
  assert.equal(specificityBySlice.city.sampleCount, 1);
  assert.notEqual(specificityBySlice.broad.value, specificityBySlice.city.value);
  assert.equal(result.summary.sliceCounts.broad, 1);
  assert.equal(result.summary.sliceCounts.city, 1);
});
