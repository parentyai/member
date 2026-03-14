'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const conversationReviewSnapshotsRepo = require('../../src/repos/firestore/conversationReviewSnapshotsRepo');
const llmActionLogsRepo = require('../../src/repos/firestore/llmActionLogsRepo');
const faqAnswerLogsRepo = require('../../src/repos/firestore/faqAnswerLogsRepo');
const { buildConversationReviewUnitsFromSources } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources');

test('phase847: buildConversationReviewUnitsFromSources returns review-ready shape with joined evidence', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    await conversationReviewSnapshotsRepo.appendConversationReviewSnapshot({
      lineUserKey: 'userkey_phase847_shape_001',
      traceId: 'trace_phase847_shape',
      routeKind: 'paid',
      strategy: 'domain_concierge',
      selectedCandidateKind: 'city_pack_backed_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      replyTemplateFingerprint: 'reply_fp_phase847',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      readinessDecision: 'allow',
      genericFallbackSlice: 'city',
      userMessageMasked: 'Seattleで住むならどこが便利ですか？',
      assistantReplyMasked: '通勤動線ならCapitol HillとBellevueを比較してみてください。',
      priorContextSummaryMasked: '',
      userMessageAvailable: true,
      assistantReplyAvailable: true,
      priorContextSummaryAvailable: false,
      textPolicy: {
        userMessage: { originalLength: 22, storedLength: 22, truncated: false, replacements: [] },
        assistantReply: { originalLength: 31, storedLength: 31, truncated: false, replacements: [] },
        priorContextSummary: { originalLength: 0, storedLength: 0, truncated: false, replacements: [] }
      },
      createdAt: '2026-03-14T15:00:00.000Z'
    });
    await llmActionLogsRepo.appendLlmActionLog({
      traceId: 'trace_phase847_shape',
      lineUserId: 'U_PHASE847_SHAPE',
      routeKind: 'paid',
      strategy: 'domain_concierge',
      strategyReason: 'explicit_city_grounded_answer',
      selectedCandidateKind: 'city_pack_backed_candidate',
      fallbackTemplateKind: 'grounded_answer_template',
      genericFallbackSlice: 'city',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: true,
      cityPackCandidateAvailable: true,
      cityPackUsedInAnswer: true,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      knowledgeGroundingKind: 'city_pack',
      readinessDecision: 'allow',
      createdAt: '2026-03-14T15:00:01.000Z'
    });
    await faqAnswerLogsRepo.appendFaqAnswerLog({
      traceId: 'trace_phase847_shape',
      questionHash: 'faq_hash_phase847_shape',
      matchedArticleIds: ['faq_1', 'faq_2'],
      createdAt: '2026-03-14T15:00:02.000Z'
    });

    const result = await buildConversationReviewUnitsFromSources({
      fromAt: '2026-03-14T14:59:00.000Z',
      toAt: '2026-03-14T15:01:00.000Z',
      limit: 20
    }, {
      getTraceBundle: async ({ traceId }) => ({
        ok: true,
        traceId,
        traceJoinSummary: {
          completeness: 1,
          joinedDomains: ['llmActions', 'faq'],
          missingDomains: [],
          criticalMissingDomains: []
        }
      })
    });

    assert.equal(result.ok, true);
    assert.equal(result.reviewUnits.length, 1);
    const unit = result.reviewUnits[0];
    assert.equal(unit.traceId, 'trace_phase847_shape');
    assert.equal(unit.lineUserKey, 'userkey_phase847_shape_001');
    assert.equal(unit.slice, 'city');
    assert.equal(unit.userMessage.available, true);
    assert.equal(unit.assistantReply.available, true);
    assert.equal(unit.priorContextSummary.available, false);
    assert.equal(unit.telemetrySignals.strategyReason, 'explicit_city_grounded_answer');
    assert.equal(unit.telemetrySignals.selectedCandidateKind, 'city_pack_backed_candidate');
    assert.equal(unit.telemetrySignals.cityPackUsedInAnswer, true);
    assert.equal(unit.telemetrySignals.savedFaqUsedInAnswer, false);
    assert.ok(Array.isArray(unit.evidenceRefs));
    assert.ok(unit.evidenceRefs.some((row) => row.source === 'conversation_review_snapshots'));
    assert.ok(unit.evidenceRefs.some((row) => row.source === 'llm_action_logs'));
    assert.ok(unit.evidenceRefs.some((row) => row.source === 'faq_answer_logs'));
    assert.ok(unit.evidenceRefs.some((row) => row.source === 'trace_bundle'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
