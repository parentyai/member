'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { detectDecisionDrift } = require('../../src/usecases/phase34/detectDecisionDrift');

test('phase34 t02: execution drift is detected', async () => {
  const result = await detectDecisionDrift({
    decisionLog: { nextAction: 'NO_ACTION' },
    opsDecisionSnapshot: {
      readiness: { status: 'READY' },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN'],
      selectedAction: 'NO_ACTION'
    },
    llmSuggestion: {
      suggestedNextActions: [
        { action: 'NO_ACTION', confidence: 0.8, rationale: 'safe', risk: 'none' }
      ]
    },
    executionResult: { execution: { action: 'RERUN_MAIN', result: 'SUCCESS', sideEffects: ['workflow_triggered'] } }
  });

  assert.strictEqual(result.driftDetected, true);
  assert.ok(result.driftTypes.includes('EXECUTION_DRIFT'));
});

