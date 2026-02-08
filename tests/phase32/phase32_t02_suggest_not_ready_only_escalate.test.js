'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestOpsDecision } = require('../../src/usecases/phase32/suggestOpsDecision');

test('phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing'] },
      allowedNextActions: ['STOP_AND_ESCALATE'],
      userStateSummary: { lineUserId: 'U2' },
      memberSummary: { lineUserId: 'U2' },
      latestDecisionLog: { id: 'd2' },
      opsState: null
    }),
    llmAdapter: {
      suggestOpsDecision: async () => ({
        suggestedNextActions: [
          { action: 'NO_ACTION', confidence: 0.4, rationale: 'ignore', risk: 'none' },
          { action: 'STOP_AND_ESCALATE', confidence: 0.9, rationale: 'not ready', risk: 'ops load' }
        ],
        notes: [],
        model: 'gpt-x'
      })
    }
  };

  const result = await suggestOpsDecision({ lineUserId: 'U2' }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.suggestedNextActions.length, 1);
  assert.strictEqual(result.suggestedNextActions[0].action, 'STOP_AND_ESCALATE');
});

