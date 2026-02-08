'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { resolveAutomationTargets } = require('../../src/usecases/phase117/resolveAutomationTargets');

test('phase117: resolve automation targets respects config filters', async () => {
  const deps = {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        targetNotificationStatus: 'active',
        targetScenarioKeys: ['s1'],
        targetStepKeys: ['stepA']
      })
    },
    listNotifications: async () => ([
      { id: 'n1', scenarioKey: 's1', stepKey: 'stepA', createdAt: '2026-02-08T00:00:00Z' },
      { id: 'n2', scenarioKey: 's2', stepKey: 'stepA' },
      { id: 'n3', scenarioKey: 's1', stepKey: 'stepB' }
    ])
  };

  const result = await resolveAutomationTargets({}, deps);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].notificationId, 'n1');
  assert.strictEqual(result[0].scenarioKey, 's1');
});
