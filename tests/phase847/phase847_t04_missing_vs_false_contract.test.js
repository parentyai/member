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

test('phase847: saved FAQ availability without activation does not require faq evidence', () => {
  const units = buildConversationReviewUnits({
    snapshots: [{
      id: 'snapshot_2',
      lineUserKey: 'userkey_phase847_saved_faq_available',
      traceId: 'trace_phase847_saved_faq_available',
      userMessageMasked: '短く要点だけで大丈夫です。',
      assistantReplyMasked: 'まず一歩目だけ決めましょう。',
      priorContextSummaryMasked: '',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false,
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      createdAt: '2026-03-14T16:10:00.000Z'
    }],
    llmActionLogs: [{
      id: 'action_2',
      traceId: 'trace_phase847_saved_faq_available',
      lineUserId: 'U_PHASE847_SAVED_FAQ_AVAILABLE',
      strategyReason: 'followup_context_expected',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'follow-up',
      priorContextUsed: false,
      followupResolvedFromHistory: true,
      knowledgeCandidateUsed: false,
      savedFaqCandidateAvailable: true,
      savedFaqUsedInAnswer: false,
      createdAt: '2026-03-14T16:10:01.000Z'
    }],
    faqAnswerLogs: [],
    traceBundles: {
      trace_phase847_saved_faq_available: {
        ok: true,
        traceId: 'trace_phase847_saved_faq_available',
        traceJoinSummary: { completeness: 1, joinedDomains: ['llmActions'], missingDomains: [], criticalMissingDomains: [] }
      }
    }
  });

  assert.equal(units.length, 1);
  const unit = units[0];
  assert.equal(unit.telemetrySignals.savedFaqCandidateAvailable, true);
  assert.equal(unit.telemetrySignals.savedFaqUsedInAnswer, false);
  assert.equal(unit.evidenceJoinStatus.faq, 'not_expected');
  assert.equal(unit.observationBlockers.some((item) => item.code === 'missing_faq_evidence'), false);
});
