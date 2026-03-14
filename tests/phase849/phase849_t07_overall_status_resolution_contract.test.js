'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: overall status resolves from signal failures before issue warnings', () => {
  const failEval = evaluate({
    reviewUnitId: 'review_unit_phase849_overall_fail',
    slice: 'broad',
    userMessage: { text: '移住で何から？', available: true },
    assistantReply: { text: '一般的には状況によります。まずは次の一手です。', available: true },
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
      replyTemplateFingerprint: 'reply_fp_phase849_overall_fail',
      repeatRiskScore: 0.8,
      committedNextActions: []
    }
  });
  const passEval = evaluate();

  const result = buildPatrolKpis({
    reviewUnits: [failEval.reviewUnit, passEval.reviewUnit],
    evaluations: [failEval.evaluation, passEval.evaluation]
  });

  assert.equal(result.summary.overallStatus, 'fail');
  assert.equal(result.metrics.specificity.status, 'fail');
});
