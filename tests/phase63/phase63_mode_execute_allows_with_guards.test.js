'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase63: execute mode allows when guard + recent dry run ok', async () => {
  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    recentDryRun: true,
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        mode: 'EXECUTE',
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    },
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK' },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    }),
    executeOpsNextAction: async () => ({ ok: true, action: 'NO_ACTION' })
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'no_action_not_executable');
});
