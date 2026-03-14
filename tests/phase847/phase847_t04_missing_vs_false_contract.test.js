'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnits } = require('../../src/domain/qualityPatrol/transcript/buildConversationReviewUnits');

test('phase847: missing telemetry stays null while explicit false is preserved', () => {
  const units = buildConversationReviewUnits({
    snapshots: [{
      id: 'snapshot_1',
      lineUserKey: 'userkey_phase847_missing_false',
      traceId: 'trace_phase847_missing_false',
      userMessageMasked: 'ユーザー質問',
      assistantReplyMasked: '返信',
      priorContextSummaryMasked: '',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      createdAt: '2026-03-14T16:00:00.000Z'
    }],
    llmActionLogs: [{
      id: 'action_1',
      traceId: 'trace_phase847_missing_false',
      lineUserId: 'U_PHASE847_FALSE',
      strategyReason: 'generic_answer',
      selectedCandidateKind: 'conversation_candidate',
      fallbackTemplateKind: 'casual_template',
      genericFallbackSlice: 'other',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      createdAt: '2026-03-14T16:00:01.000Z'
    }],
    faqAnswerLogs: [],
    traceBundles: {
      trace_phase847_missing_false: {
        ok: true,
        traceId: 'trace_phase847_missing_false',
        traceJoinSummary: { completeness: 1, joinedDomains: ['llmActions'], missingDomains: [], criticalMissingDomains: [] }
      }
    }
  });

  assert.equal(units.length, 1);
  const unit = units[0];
  assert.equal(unit.telemetrySignals.priorContextUsed, false);
  assert.equal(unit.telemetrySignals.followupResolvedFromHistory, false);
  assert.equal(unit.telemetrySignals.cityPackUsedInAnswer, null);
  assert.equal(unit.telemetrySignals.savedFaqUsedInAnswer, null);
});
