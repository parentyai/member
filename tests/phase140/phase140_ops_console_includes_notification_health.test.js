'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

test('phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only)', async () => {
  const readiness = { status: 'READY', blocking: [] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null },
    getNotificationReadModel: async () => ([
      {
        notificationId: 'N_BAD',
        title: 'bad',
        scenarioKey: 's1',
        stepKey: 'st1',
        reactionSummary: { sent: 40, clicked: 1, ctr: 0.025 },
        notificationHealth: 'DANGER',
        lastSentAt: '2026-02-09T00:00:00.000Z'
      },
      {
        notificationId: 'N_OK',
        title: 'ok',
        scenarioKey: 's1',
        stepKey: 'st1',
        reactionSummary: { sent: 10, clicked: 3, ctr: 0.3 },
        notificationHealth: 'OK',
        lastSentAt: '2026-02-09T00:00:00.000Z'
      }
    ])
  };

  const result = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.lineUserId, 'U1');

  assert.ok(Object.prototype.hasOwnProperty.call(result, 'notificationHealthSummary'));
  assert.ok(result.notificationHealthSummary);
  assert.strictEqual(result.notificationHealthSummary.totalNotifications, 2);
  assert.strictEqual(result.notificationHealthSummary.unhealthyCount, 1);
  assert.strictEqual(result.notificationHealthSummary.countsByHealth.DANGER, 1);

  assert.ok(Array.isArray(result.topUnhealthyNotifications));
  assert.strictEqual(result.topUnhealthyNotifications[0].notificationId, 'N_BAD');

  assert.ok(Object.prototype.hasOwnProperty.call(result, 'mitigationSuggestion'));
  assert.ok(result.mitigationSuggestion);
  assert.strictEqual(result.mitigationSuggestion.actionType, 'PAUSE_AND_REVIEW');
});

