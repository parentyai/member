'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { dryRunAutomationDecision } = require('../../src/usecases/phase47/dryRunAutomationDecision');

test('phase47: dry-run returns guard without writes', async () => {
  const deps = {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    },
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK' },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    })
  };

  const result = await dryRunAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, deps);

  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.ok, true);
  assert.ok(result.guard);
});
