'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestOpsDecision } = require('../../src/usecases/phase32/suggestOpsDecision');

test('phase32 t03: llm failure yields empty suggestions', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION'],
      userStateSummary: { lineUserId: 'U3' },
      memberSummary: { lineUserId: 'U3' },
      latestDecisionLog: { id: 'd3' },
      opsState: null
    }),
    llmAdapter: {
      suggestOpsDecision: async () => {
        throw new Error('llm down');
      }
    }
  };

  const result = await suggestOpsDecision({ lineUserId: 'U3' }, deps);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.suggestedNextActions, []);
});

