'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase43: automation disabled by default', async () => {
  const deps = {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => null
    }
  };

  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true
  }, deps);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'automation_disabled');
});
