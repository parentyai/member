'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { detectDecisionDrift } = require('../../src/usecases/phase34/detectDecisionDrift');

test('phase34 t04: no drift when suggestion/ops/execution align', async () => {
  const result = await detectDecisionDrift({
    decisionLog: { nextAction: 'NO_ACTION' },
    opsDecisionSnapshot: {
      readiness: { status: 'READY' },
      allowedNextActions: ['NO_ACTION'],
      selectedAction: 'NO_ACTION'
    },
    llmSuggestion: {
      suggestedNextActions: [
        { action: 'NO_ACTION', confidence: 0.9, rationale: 'safe', risk: 'none' }
      ]
    },
    executionResult: { execution: { action: 'NO_ACTION', result: 'SUCCESS', sideEffects: ['no_action'] } }
  });

  assert.strictEqual(result.driftDetected, false);
  assert.deepStrictEqual(result.driftTypes, []);
});

