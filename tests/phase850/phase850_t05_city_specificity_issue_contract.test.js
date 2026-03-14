'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: city specificity issue is detected with high severity', () => {
  const city = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_city_specificity',
    slice: 'city',
    userMessage: { text: 'Seattleで子育てしやすいエリアは？', available: true },
    assistantReply: { text: '候補があります。', available: true },
    telemetrySignals: {
      strategyReason: 'explicit_city_grounded_answer',
      selectedCandidateKind: 'city_pack_backed_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      finalizerTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: null,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase850_city_specificity',
      repeatRiskScore: 0.1
    }
  });

  const result = detectIssues({
    kpiResult: buildKpiResultFromEntries([city])
  });

  const issue = result.issueCandidates.find((item) => item.metricKey === 'citySpecificityMissingRate' && item.slice === 'city');
  assert.ok(issue);
  assert.equal(issue.severity, 'high');
});
