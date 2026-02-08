'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestOpsDecision } = require('../../src/usecases/phase32/suggestOpsDecision');
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

test('phase34 t05: phase32 -> phase33 -> phase34 appends decision drift', async () => {
  const captured = [];
  const baseConsole = async () => ({
    readiness: { status: 'READY', blocking: [] },
    allowedNextActions: ['NO_ACTION', 'FIX_AND_RERUN']
  });

  const suggestion = await suggestOpsDecision({ lineUserId: 'U1' }, {
    getOpsConsole: baseConsole,
    llmAdapter: {
      suggestOpsDecision: async () => ({
        suggestedNextActions: [
          { action: 'FIX_AND_RERUN', confidence: 0.7, rationale: 'impl', risk: 'cost' }
        ],
        notes: ['note'],
        model: 'gpt-x'
      })
    }
  });

  const result = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    llmSuggestion: suggestion
  }, {
    getOpsConsole: baseConsole,
    decisionLogsRepo: {
      listDecisions: async () => ([]),
      getDecisionById: async () => ({ id: 'd1', nextAction: 'NO_ACTION' }),
      appendDecision: async () => ({ id: 'exec-1' })
    },
    opsStatesRepo: {
      upsertOpsState: async () => ({ id: 'U1' })
    },
    decisionDriftsRepo: {
      appendDecisionDrift: async (payload) => {
        captured.push(payload);
        return { id: 'drift-1' };
      }
    }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(captured.length, 1);
  assert.ok(captured[0].driftTypes.includes('SUGGESTION_DRIFT'));
  assert.strictEqual(captured[0].decisionLogId, 'd1');
  assert.strictEqual(captured[0].lineUserId, 'U1');
});

