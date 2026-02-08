'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase47: automation timeline links decision log', async () => {
  const timeline = [];
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
    }),
    executeOpsNextAction: async () => ({ ok: true, action: 'NO_ACTION' }),
    decisionTimelineRepo: {
      appendTimelineEntry: async (entry) => {
        timeline.push(entry);
        return { id: 't1' };
      }
    }
  };

  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(timeline.length, 1);
  assert.strictEqual(timeline[0].refId, 'd1');
  assert.strictEqual(timeline[0].action, 'AUTOMATION');
});
