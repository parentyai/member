'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase47: execute requires readiness OK', async () => {
  const deps = {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    },
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing'] },
      consistency: { status: 'OK' },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    }),
    submitOpsDecision: async () => ({ ok: true, decisionLogId: 'd2' }),
    decisionTimelineRepo: { appendTimelineEntry: async () => ({ id: 't1' }) }
  };

  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    recentDryRun: true
  }, deps);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'automation_guard_failed');
});
