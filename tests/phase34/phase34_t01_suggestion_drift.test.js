'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { detectDecisionDrift } = require('../../src/usecases/phase34/detectDecisionDrift');

test('phase34 t01: suggestion drift is detected', async () => {
  const result = await detectDecisionDrift({
    decisionLog: { nextAction: 'NO_ACTION' },
    opsDecisionSnapshot: {
      readiness: { status: 'READY' },
      allowedNextActions: ['NO_ACTION', 'FIX_AND_RERUN'],
      selectedAction: 'NO_ACTION'
    },
    llmSuggestion: {
      suggestedNextActions: [
        { action: 'FIX_AND_RERUN', confidence: 0.6, rationale: 'impl', risk: 'cost' }
      ]
    },
    executionResult: { execution: { action: 'NO_ACTION', result: 'SUCCESS', sideEffects: ['no_action'] } }
  });

  assert.strictEqual(result.driftDetected, true);
  assert.deepStrictEqual(result.driftTypes, ['SUGGESTION_DRIFT']);
});

