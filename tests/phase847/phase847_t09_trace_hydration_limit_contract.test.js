'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationReviewUnitsFromSources } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources');

test('phase847: trace hydration limit does not create artificial missing trace blockers', async () => {
  const traceCalls = [];
  const result = await buildConversationReviewUnitsFromSources({
    limit: 10,
    traceLimit: 1
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => []
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        {
          id: 'action_trace_1',
          traceId: 'trace_limit_1',
          lineUserId: 'U_TRACE_LIMIT_1',
          strategyReason: 'trace_limit_anchor_1',
          createdAt: '2026-03-14T14:00:00.000Z'
        },
        {
          id: 'action_trace_2',
          traceId: 'trace_limit_2',
          lineUserId: 'U_TRACE_LIMIT_2',
          strategyReason: 'trace_limit_anchor_2',
          createdAt: '2026-03-14T13:59:59.000Z'
        }
      ])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => []
    },
    getTraceBundle: async ({ traceId }) => {
      traceCalls.push(traceId);
      return {
        ok: true,
        traceId,
        traceJoinSummary: {
          completeness: 1,
          joinedDomains: ['llmActions'],
          missingDomains: [],
          criticalMissingDomains: []
        }
      };
    }
  });

  assert.deepEqual(traceCalls, ['trace_limit_1']);
  assert.equal(result.reviewUnits.length, 2);
  assert.equal(result.joinDiagnostics.traceHydrationLimitedCount, 1);
  assert.deepEqual(result.joinDiagnostics.reviewUnitAnchorKindCounts, {
    action_only: 2
  });

  const limitedUnit = result.reviewUnits.find((unit) => unit.traceId === 'trace_limit_2');
  assert.ok(limitedUnit);
  assert.equal(limitedUnit.evidenceJoinStatus.trace, 'limited_by_trace_hydration');
  assert.ok(!(limitedUnit.observationBlockers || []).some((row) => row.code === 'missing_trace_evidence'));
});

test('phase847: default trace hydration limit follows review limit to avoid artificial backlog debt', async () => {
  const traceCalls = [];
  const result = await buildConversationReviewUnitsFromSources({
    limit: 3
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => []
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        {
          id: 'action_trace_default_1',
          traceId: 'trace_default_1',
          lineUserId: 'U_TRACE_DEFAULT_1',
          strategyReason: 'default_trace_anchor_1',
          createdAt: '2026-03-14T14:00:00.000Z'
        },
        {
          id: 'action_trace_default_2',
          traceId: 'trace_default_2',
          lineUserId: 'U_TRACE_DEFAULT_2',
          strategyReason: 'default_trace_anchor_2',
          createdAt: '2026-03-14T13:59:59.000Z'
        },
        {
          id: 'action_trace_default_3',
          traceId: 'trace_default_3',
          lineUserId: 'U_TRACE_DEFAULT_3',
          strategyReason: 'default_trace_anchor_3',
          createdAt: '2026-03-14T13:59:58.000Z'
        }
      ])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => []
    },
    getTraceBundle: async ({ traceId }) => {
      traceCalls.push(traceId);
      return {
        ok: true,
        traceId,
        traceJoinSummary: {
          completeness: 1,
          joinedDomains: ['llmActions'],
          missingDomains: [],
          criticalMissingDomains: []
        }
      };
    }
  });

  assert.deepEqual(traceCalls, ['trace_default_1', 'trace_default_2', 'trace_default_3']);
  assert.equal(result.joinDiagnostics.traceHydrationLimitedCount, 0);
  assert.equal(result.reviewUnits.length, 3);
  assert.ok(result.reviewUnits.every((unit) => unit.evidenceJoinStatus.trace === 'joined'));
});

test('phase847: latest review-unit extraction aligns snapshot and faq reads to the action-log window', async () => {
  const snapshotCalls = [];
  const faqCalls = [];
  const result = await buildConversationReviewUnitsFromSources({
    limit: 2,
    traceLimit: 2
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async (params) => {
        snapshotCalls.push(params);
        return [
          {
            id: 'snapshot_align_1',
            traceId: 'trace_align_1',
            lineUserKey: 'userkey_align_1',
            userMessageAvailable: true,
            assistantReplyAvailable: true,
            priorContextSummaryAvailable: false,
            userMessageMasked: 'aligned question',
            assistantReplyMasked: 'aligned reply',
            createdAt: '2026-03-14T14:00:00.000Z'
          }
        ];
      }
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([
        {
          id: 'action_align_1',
          traceId: 'trace_align_1',
          lineUserId: 'U_ALIGN_1',
          strategyReason: 'align_anchor_1',
          createdAt: '2026-03-14T14:00:00.000Z'
        },
        {
          id: 'action_align_2',
          traceId: 'trace_align_2',
          lineUserId: 'U_ALIGN_2',
          strategyReason: 'align_anchor_2',
          createdAt: '2026-03-14T13:59:30.000Z'
        }
      ])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async (params) => {
        faqCalls.push(params);
        return [
          {
            id: 'faq_align_skip_no_trace',
            traceId: null,
            createdAt: '2026-03-14T14:00:02.000Z'
          },
          {
            id: 'faq_align_skip_unmatched',
            traceId: 'trace_align_unmatched',
            createdAt: '2026-03-14T14:00:02.500Z'
          },
          {
            id: 'faq_align_1',
            traceId: 'trace_align_1',
            createdAt: '2026-03-14T14:00:01.000Z'
          }
        ];
      }
    },
    getTraceBundle: async ({ traceId }) => ({
      ok: true,
      traceId,
      traceJoinSummary: {
        completeness: 1,
        joinedDomains: ['llmActions'],
        missingDomains: [],
        criticalMissingDomains: []
      }
    })
  });

  assert.deepEqual(snapshotCalls, [{
    fromAt: '2026-03-14T13:59:30.000Z',
    toAt: '2026-03-14T14:00:00.000Z',
    limit: 12
  }]);
  assert.deepEqual(faqCalls, [{
    fromAt: '2026-03-14T13:59:30.000Z',
    toAt: '2026-03-14T14:00:00.000Z',
    limit: 4
  }]);
  assert.deepEqual(result.sourceWindow, {
    fromAt: '2026-03-14T13:59:30.000Z',
    toAt: '2026-03-14T14:00:00.000Z'
  });
  assert.equal(result.joinDiagnostics.faqOnlyRowsSkipped, 0);
  const alignedUnit = result.reviewUnits.find((unit) => unit.traceId === 'trace_align_1');
  assert.ok(alignedUnit);
  assert.equal(alignedUnit.evidenceJoinStatus.faq, 'joined');
  assert.ok(alignedUnit.evidenceRefs.some((row) => row.source === 'faq_answer_logs' && row.refId === 'faq_align_1'));
});

test('phase847: latest review-unit extraction widens snapshot reads to avoid action-only drift from duplicate snapshot writes', async () => {
  const snapshotCalls = [];
  const result = await buildConversationReviewUnitsFromSources({
    limit: 100,
    traceLimit: 100
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async (params) => {
        snapshotCalls.push(params);
        if (params.limit < 500) return [];
        return [
          {
            id: 'snapshot_wide_1',
            traceId: 'trace_wide_95',
            lineUserKey: 'userkey_wide_95',
            userMessageAvailable: true,
            assistantReplyAvailable: true,
            priorContextSummaryAvailable: true,
            userMessageMasked: 'wide question',
            assistantReplyMasked: 'wide reply',
            priorContextSummaryMasked: 'resume_domain:general',
            createdAt: '2026-03-14T12:58:25.000Z'
          }
        ];
      }
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => Array.from({ length: 95 }, (_, index) => ({
        id: `action_wide_${index + 1}`,
        traceId: `trace_wide_${index + 1}`,
        lineUserId: `U_WIDE_${index + 1}`,
        strategyReason: `wide_anchor_${index + 1}`,
        priorContextUsed: index === 94,
        followupResolvedFromHistory: index === 94,
        createdAt: new Date(Date.UTC(2026, 2, 14, 14, 0, 0) - index * 1000).toISOString()
      }))
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => []
    },
    getTraceBundle: async ({ traceId }) => ({
      ok: true,
      traceId,
      traceJoinSummary: {
        completeness: 1,
        joinedDomains: ['llmActions', 'conversation_review_snapshots'],
        missingDomains: [],
        criticalMissingDomains: []
      }
    })
  });

  assert.equal(snapshotCalls.length, 1);
  assert.equal(snapshotCalls[0].limit, 500);
  assert.equal(result.readLimits.snapshotReadLimit, 500);
  const widenedUnit = result.reviewUnits.find((unit) => unit.traceId === 'trace_wide_95');
  assert.ok(widenedUnit);
  assert.equal(widenedUnit.anchorKind, 'snapshot_action');
  assert.equal(widenedUnit.priorContextSummary.available, true);
  assert.ok(!(widenedUnit.observationBlockers || []).some((row) => row.code === 'missing_prior_context_summary'));
});

test('phase847: latest review-unit extraction ignores synthetic patrol replay rows unless an explicit window is requested', async () => {
  const syntheticRow = {
    id: 'action_cycle_1',
    requestId: 'quality_patrol_cycle_123_0',
    traceId: 'quality_patrol_cycle_123_0',
    lineUserId: 'U_CYCLE_1',
    strategyReason: 'cycle_anchor',
    createdAt: '2026-03-24T23:30:16.847Z'
  };
  const organicRow = {
    id: 'action_live_1',
    requestId: 'line_webhook_live_1',
    traceId: 'trace_live_1',
    lineUserId: 'U_LIVE_1',
    strategyReason: 'live_anchor',
    createdAt: '2026-03-24T23:29:16.847Z'
  };
  const deps = {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => []
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([syntheticRow, organicRow])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => []
    },
    getTraceBundle: async ({ traceId }) => ({
      ok: true,
      traceId,
      traceJoinSummary: {
        completeness: 1,
        joinedDomains: ['llmActions'],
        missingDomains: [],
        criticalMissingDomains: []
      }
    })
  };

  const latestResult = await buildConversationReviewUnitsFromSources({
    limit: 10,
    traceLimit: 10
  }, deps);
  assert.deepEqual(latestResult.reviewUnits.map((unit) => unit.traceId), ['trace_live_1']);

  const explicitWindowResult = await buildConversationReviewUnitsFromSources({
    fromAt: '2026-03-24T23:29:00.000Z',
    toAt: '2026-03-24T23:31:00.000Z',
    limit: 10,
    traceLimit: 10
  }, deps);
  assert.deepEqual(explicitWindowResult.reviewUnits.map((unit) => unit.traceId), ['quality_patrol_cycle_123_0', 'trace_live_1']);
});

test('phase847: explicit review window preserves snapshot evidence even when action logs are absent', async () => {
  const result = await buildConversationReviewUnitsFromSources({
    fromAt: '2026-03-24T23:29:00.000Z',
    toAt: '2026-03-24T23:31:00.000Z',
    limit: 10,
    traceLimit: 10
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => ([
        {
          id: 'snapshot_cycle_1',
          traceId: 'quality_patrol_cycle_123_0',
          userMessageAvailable: false,
          assistantReplyAvailable: false,
          createdAt: '2026-03-24T23:30:16.847Z'
        },
        {
          id: 'snapshot_live_1',
          traceId: 'trace_live_snapshot_1',
          userMessageAvailable: true,
          assistantReplyAvailable: true,
          userMessageMasked: 'live question',
          assistantReplyMasked: 'live reply',
          createdAt: '2026-03-24T23:29:16.847Z'
        }
      ])
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => ([
        {
          id: 'faq_cycle_1',
          traceId: 'quality_patrol_cycle_123_0',
          createdAt: '2026-03-24T23:30:16.847Z'
        }
      ])
    },
    getTraceBundle: async ({ traceId }) => ({
      ok: true,
      traceId,
      traceJoinSummary: {
        completeness: 1,
        joinedDomains: ['conversation_review_snapshots'],
        missingDomains: [],
        criticalMissingDomains: []
      }
    })
  });

  assert.deepEqual(result.reviewUnits.map((unit) => unit.traceId), ['quality_patrol_cycle_123_0', 'trace_live_snapshot_1']);
  assert.equal(result.joinDiagnostics.faqOnlyRowsSkipped, 0);
});

test('phase847: latest review-unit extraction short-circuits when no canonical action window exists', async () => {
  let snapshotReads = 0;
  let faqReads = 0;
  const result = await buildConversationReviewUnitsFromSources({
    limit: 100,
    traceLimit: 100
  }, {
    conversationReviewSnapshotsRepo: {
      listConversationReviewSnapshotsByCreatedAtRange: async () => {
        snapshotReads += 1;
        return [];
      }
    },
    llmActionLogsRepo: {
      listLlmActionLogsByCreatedAtRange: async () => ([])
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByCreatedAtRange: async () => {
        faqReads += 1;
        return [];
      }
    },
    getTraceBundle: async () => null
  });

  assert.equal(result.reviewUnits.length, 0);
  assert.equal(result.counts.llmActionLogs, 0);
  assert.equal(result.counts.snapshots, 0);
  assert.equal(result.counts.faqAnswerLogs, 0);
  assert.equal(snapshotReads, 0);
  assert.equal(faqReads, 0);
});
