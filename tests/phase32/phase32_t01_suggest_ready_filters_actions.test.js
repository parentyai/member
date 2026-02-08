'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestOpsDecision } = require('../../src/usecases/phase32/suggestOpsDecision');

test('phase32 t01: READY suggestions filtered to allowedNextActions', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN'],
      userStateSummary: { lineUserId: 'U1' },
      memberSummary: { lineUserId: 'U1' },
      latestDecisionLog: { id: 'd1' },
      opsState: { nextAction: 'NO_ACTION' }
    }),
    llmAdapter: {
      suggestOpsDecision: async () => ({
        suggestedNextActions: [
          { action: 'FIX_AND_RERUN', confidence: 0.7, rationale: 'impl', risk: 'cost' },
          { action: 'RERUN_MAIN', confidence: 0.8, rationale: 'rerun', risk: 'cost' }
        ],
        notes: ['note'],
        model: 'gpt-x'
      })
    }
  };

  const result = await suggestOpsDecision({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.suggestedNextActions.length, 1);
  assert.strictEqual(result.suggestedNextActions[0].action, 'RERUN_MAIN');
});

