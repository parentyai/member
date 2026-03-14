'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluate } = require('./phase849_helpers');

test('phase849: issue candidate rates aggregate from evaluator output', () => {
  const broad1 = evaluate({
    reviewUnitId: 'review_unit_phase849_issue_broad_1',
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
      replyTemplateFingerprint: 'reply_fp_phase849_issue_broad_1',
      repeatRiskScore: 0.8,
      committedNextActions: []
    }
  });
  const broad2 = evaluate({
    reviewUnitId: 'review_unit_phase849_issue_broad_2',
    slice: 'broad',
    userMessage: { text: '移住で必要な手順は？', available: true },
    assistantReply: { text: 'まずビザ要件を確認して、次に必要書類を一覧化してください。', available: true },
    telemetrySignals: {
      strategyReason: 'broad_question',
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
      replyTemplateFingerprint: 'reply_fp_phase849_issue_broad_2',
      repeatRiskScore: 0.1
    }
  });

  const result = buildPatrolKpis({
    reviewUnits: [broad1.reviewUnit, broad2.reviewUnit],
    evaluations: [broad1.evaluation, broad2.evaluation]
  });

  assert.equal(result.issueCandidateMetrics.broadAbstractEscapeRate.sampleCount, 2);
  assert.equal(result.issueCandidateMetrics.broadAbstractEscapeRate.value, 0.5);
  assert.equal(result.issueCandidateMetrics.nextStepMissingRate.sampleCount, 2);
});
