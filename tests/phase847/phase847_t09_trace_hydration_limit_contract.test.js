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
