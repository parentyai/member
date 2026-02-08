'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistContext } = require('../../src/usecases/phase38/getOpsAssistContext');

test('phase38: getOpsAssistContext returns read-only payload', async () => {
  const deps = {
    getUserStateSummary: async () => ({ lineUserId: 'U1', overallDecisionReadiness: { status: 'READY' } }),
    getMemberSummary: async () => ({ ok: true, lineUserId: 'U1' }),
    getOpsConsole: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      executionStatus: { lastExecutionResult: 'UNKNOWN', lastExecutedAt: null },
      allowedNextActions: ['NO_ACTION'],
      readiness: { status: 'READY', blocking: [] }
    }),
    decisionTimelineRepo: {
      listTimelineEntries: async () => ([{ id: 't1', action: 'DECIDE' }])
    },
    getNotificationDecisionTrace: async () => ({
      firstDecisionLogId: 'd1',
      lastDecisionLogId: 'd2',
      lastExecutionResult: 'OK',
      lastExecutedAt: '2026-02-08T00:00:00.000Z'
    })
  };

  const result = await getOpsAssistContext({ lineUserId: 'U1', notificationId: 'n1' }, deps);
  assert.ok(result.userStateSummary);
  assert.ok(result.memberSummary);
  assert.ok(result.notificationSummary);
  assert.deepStrictEqual(result.notificationSummary.decisionTrace.lastExecutionResult, 'OK');
  assert.ok(Array.isArray(result.decisionTimeline));
  assert.strictEqual(result.decisionTimeline.length, 1);
  assert.strictEqual(result.constraints.readiness, 'READY');
});
