'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

test('phase131: ops console includes add-only display fields (LINE-only reaction + execution message)', async () => {
  const result = await getOpsConsole({
    lineUserId: 'U1',
    traceId: 'TRACE1'
  }, {
    getUserStateSummary: async () => ({
      lineUserId: 'U1',
      lastReactionAt: '2026-02-08T00:00:00.000Z',
      userSummaryCompleteness: { missing: ['stale_member_number'] }
    }),
    getMemberSummary: async () => ({ lineUserId: 'U1' }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: {
      getLatestDecision: async (subjectType, subjectId) => {
        if (subjectType === 'user' && subjectId === 'U1') {
          return {
            id: 'd1',
            subjectType,
            subjectId,
            nextAction: 'NO_ACTION',
            decidedBy: 'ops',
            decidedAt: '2026-02-08T01:00:00.000Z'
          };
        }
        if (subjectType === 'ops_execution' && subjectId === 'd1') return null;
        return null;
      }
    }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.lastReactionAt, '2026-02-08T00:00:00.000Z');
  assert.strictEqual(result.executionState, 'NOT_EXECUTED');
  assert.ok(String(result.executionMessage).includes('NO_ACTION'));
  assert.strictEqual(result.dangerFlags.staleMemberNumber, true);
  assert.strictEqual(result.traceId, 'TRACE1');
  assert.ok(result.latestDecisionSummary);
  assert.strictEqual(result.latestDecisionSummary.nextAction, 'NO_ACTION');
});

