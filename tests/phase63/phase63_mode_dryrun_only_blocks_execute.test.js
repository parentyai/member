'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase63: dry_run_only blocks execute', async () => {
  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    recentDryRun: true
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        mode: 'DRY_RUN_ONLY',
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    }
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'automation_dry_run_only');
});
