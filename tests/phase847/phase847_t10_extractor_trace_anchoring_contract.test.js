'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnitsFromSources } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources');

function createTraceBundle(traceId, faqAnswerLogs) {
  return {
    ok: true,
    traceId,
    joins: {
      faqAnswerLogs: Array.isArray(faqAnswerLogs) ? faqAnswerLogs : []
    },
    traceJoinSummary: {
      completeness: 1,
      joinedDomains: ['llmActions'].concat(Array.isArray(faqAnswerLogs) && faqAnswerLogs.length > 0 ? ['faq'] : []),
      missingDomains: [],
      criticalMissingDomains: []
    }
  };
}

test('phase847: extractor backfills snapshots by trace when latest snapshot range is crowded by duplicate traces', async () => {
  const result = await buildConversationReviewUnitsFromSources({
    limit: 2,
    traceLimit: 2
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => ([
        {
          id: 'snapshot_trace_a_1',
          traceId: 'trace_a',
          lineUserKey: 'line_a',
          userMessageMasked: 'A1',
          assistantReplyMasked: 'A1',
          userMessageAvailable: true,
          assistantReplyAvailable: true,
          priorContextSummaryAvailable: false,
          createdAt: '2026-03-20T10:00:00.000Z'
        },
        {
          id: 'snapshot_trace_a_2',
          traceId: 'trace_a',
          lineUserKey: 'line_a',
          userMessageMasked: 'A2',
          assistantReplyMasked: 'A2',
          userMessageAvailable: true,
          assistantReplyAvailable: true,
          priorContextSummaryAvailable: false,
          createdAt: '2026-03-20T09:59:59.000Z'
        }
      ]),
      listConversationReviewSnapshotsByTraceId: async ({ traceId }) => {
        if (traceId !== 'trace_b') return [];
        return [{
          id: 'snapshot_trace_b_1',
          traceId: 'trace_b',
          lineUserKey: 'line_b',
          userMessageMasked: 'B1',
          assistantReplyMasked: 'B1',
          userMessageAvailable: true,
          assistantReplyAvailable: true,
          priorContextSummaryAvailable: false,
          createdAt: '2026-03-20T09:59:58.000Z'
        }];
      }
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        {
          id: 'action_trace_a',
          traceId: 'trace_a',
          lineUserId: 'U_TRACE_A',
          createdAt: '2026-03-20T10:00:00.000Z'
        },
        {
          id: 'action_trace_b',
          traceId: 'trace_b',
          lineUserId: 'U_TRACE_B',
          createdAt: '2026-03-20T09:59:58.000Z'
        }
      ])
    },
    getTraceBundle: async ({ traceId }) => createTraceBundle(traceId, [])
  });

  assert.equal(result.reviewUnits.length, 2);
  assert.deepEqual(result.joinDiagnostics.reviewUnitAnchorKindCounts, {
    snapshot_action: 2
  });
  assert.equal(result.counts.snapshots, 3);
  assert.equal(result.reviewUnits.every((unit) => unit.anchorKind === 'snapshot_action'), true);
});

test('phase847: extractor keeps FAQ evidence trace-anchored and avoids standalone FAQ contamination', async () => {
  const result = await buildConversationReviewUnitsFromSources({
    limit: 1,
    traceLimit: 1
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => ([
        {
          id: 'snapshot_trace_faq',
          traceId: 'trace_faq',
          lineUserKey: 'line_faq',
          userMessageMasked: 'FAQ',
          assistantReplyMasked: 'FAQ',
          userMessageAvailable: true,
          assistantReplyAvailable: true,
          priorContextSummaryAvailable: false,
          createdAt: '2026-03-20T11:00:00.000Z'
        }
      ]),
      listConversationReviewSnapshotsByTraceId: async () => []
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        {
          id: 'action_trace_faq',
          traceId: 'trace_faq',
          lineUserId: 'U_TRACE_FAQ',
          savedFaqCandidateAvailable: true,
          createdAt: '2026-03-20T11:00:01.000Z'
        }
      ])
    },
    getTraceBundle: async ({ traceId }) => createTraceBundle(traceId, [{
      id: 'faq_trace_faq',
      traceId: 'trace_faq',
      matchedArticleIds: ['faq_1'],
      createdAt: '2026-03-20T11:00:02.000Z'
    }])
  });

  assert.equal(result.joinDiagnostics.faqOnlyRowsSkipped, 0);
  assert.equal(result.counts.faqAnswerLogs, 1);
  assert.equal(result.reviewUnits.length, 1);
  assert.equal(result.reviewUnits[0].evidenceJoinStatus.faq, 'joined');
  assert.ok(result.reviewUnits[0].evidenceRefs.some((row) => row.source === 'faq_answer_logs'));
});

test('phase847: default trace limit follows requested limit to avoid artificial join debt in default windows', async () => {
  const traceCalls = [];
  const result = await buildConversationReviewUnitsFromSources({
    limit: 3
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => [],
      listConversationReviewSnapshotsByTraceId: async () => []
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        { id: 'action_1', traceId: 'trace_1', lineUserId: 'U1', createdAt: '2026-03-20T12:00:00.000Z' },
        { id: 'action_2', traceId: 'trace_2', lineUserId: 'U2', createdAt: '2026-03-20T11:59:59.000Z' },
        { id: 'action_3', traceId: 'trace_3', lineUserId: 'U3', createdAt: '2026-03-20T11:59:58.000Z' }
      ])
    },
    getTraceBundle: async ({ traceId }) => {
      traceCalls.push(traceId);
      return createTraceBundle(traceId, []);
    }
  });

  assert.deepEqual(traceCalls, ['trace_1', 'trace_2', 'trace_3']);
  assert.equal(result.joinDiagnostics.traceHydrationLimitedCount, 0);
});
