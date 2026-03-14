'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: high follow-up fallback repetition escalates to high severity', () => {
  const followup = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_followup_fallback',
    slice: 'follow-up',
    userMessage: { text: '前回の続きですが、次は？', available: true },
    assistantReply: { text: 'まずは次の一手です。まずは次の一手です。', available: true },
    priorContextSummary: { text: '前回は住民登録の話をしていた。', available: true },
    telemetrySignals: {
      strategyReason: 'followup_context_expected',
      selectedCandidateKind: 'conversation_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'follow-up',
      priorContextUsed: true,
      followupResolvedFromHistory: true,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase850_followup_repeated',
      repeatRiskScore: 0.88,
      committedNextActions: []
    },
    observationBlockers: []
  });

  const result = detectIssues({
    kpiResult: buildKpiResultFromEntries([followup])
  });

  const issue = result.issueCandidates.find((item) => item.metricKey === 'fallbackRepetition' && item.slice === 'follow-up');
  assert.ok(issue);
  assert.equal(issue.severity, 'high');
});
