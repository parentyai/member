'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: blocked observation metrics become blocker issues instead of fail issues', () => {
  const blockedFollowup = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_blocked_followup',
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
      replyTemplateFingerprint: 'reply_fp_phase850_blocked_followup',
      repeatRiskScore: null
    },
    observationBlockers: [
      { code: 'missing_user_message', severity: 'high', message: 'missing user message', source: 'conversation_review_units' },
      { code: 'missing_trace_evidence', severity: 'medium', message: 'missing trace evidence', source: 'conversation_review_units' },
      { code: 'transcript_not_reviewable', severity: 'high', message: 'transcript not reviewable', source: 'conversation_review_units' }
    ]
  });

  const result = detectIssues({
    kpiResult: buildKpiResultFromEntries([blockedFollowup])
  });

  const blockedIssue = result.issueCandidates.find((item) => item.metricKey === 'blockedFollowupJudgementRate' && item.slice === 'follow-up');
  assert.ok(blockedIssue);
  assert.equal(blockedIssue.issueType, 'observation_blocker');
  assert.equal(blockedIssue.status, 'blocked');
  assert.equal(result.issueCandidates.some((item) => item.metricKey === 'continuity' && item.status === 'open'), false);
});
