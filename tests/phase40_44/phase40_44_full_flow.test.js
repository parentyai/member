'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsoleView } = require('../../src/usecases/phase42/getOpsConsoleView');
const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');
const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

const timeline = [];

const decisionTimelineRepo = {
  appendTimelineEntry: async (entry) => {
    timeline.push(entry);
    return { id: `t${timeline.length}` };
  },
  listTimelineEntries: async () => timeline.slice().reverse()
};

test('phase40-44: full flow returns view + automation executes', async () => {
  const contextDeps = {
    decisionTimelineRepo,
    getOpsAssistContext: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] }
    })
  };

  const suggestion = await getOpsAssistSuggestion({ lineUserId: 'U1' }, contextDeps);
  assert.ok(suggestion.disclaimer);

  const view = await getOpsConsoleView({ lineUserId: 'U1' }, {
    getOpsConsole: async () => ({
      opsState: { nextAction: 'NO_ACTION', updatedAt: '2026-02-08T00:00:00Z' },
      allowedNextActions: ['NO_ACTION'],
      readiness: { status: 'READY', blocking: [] }
    }),
    getOpsAssistContext: async () => ({ decisionTimeline: timeline }),
    getOpsAssistSuggestion: async () => suggestion
  });
  assert.ok(view.llmSuggestion);

  const result = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    confirmedBy: 'ops',
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ enabled: true, allowedActions: ['NO_ACTION'], requireConfirmation: true })
    },
    decisionTimelineRepo,
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK', issues: [] },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    }),
    executeOpsNextAction: async () => ({ ok: true, executionLogId: 'exec1' })
  });

  assert.strictEqual(result.ok, true);
  assert.ok(timeline.some((entry) => entry.source === 'llm_assist'));
  assert.ok(timeline.some((entry) => entry.action === 'AUTOMATION'));
});
