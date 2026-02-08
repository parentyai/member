'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase44: automation guard triggers escalation', async () => {
  const timelineEntries = [];
  const deps = {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ enabled: true, allowedActions: ['NO_ACTION'], requireConfirmation: true })
    },
    decisionTimelineRepo: {
      appendTimelineEntry: async (entry) => {
        timelineEntries.push(entry);
        return { id: 't1' };
      }
    },
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing'] },
      consistency: { status: 'OK', issues: [] },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    }),
    submitOpsDecision: async () => ({ ok: true, decisionLogId: 'd2' })
  };

  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    confirmedBy: 'ops'
  }, deps);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'automation_guard_failed');
  assert.ok(result.escalation);
  const entry = timelineEntries.find((item) => item.action === 'AUTOMATION');
  assert.ok(entry);
  assert.strictEqual(entry.snapshot.guard.status, 'FAIL');
});
