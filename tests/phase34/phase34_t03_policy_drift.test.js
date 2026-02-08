'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { detectDecisionDrift } = require('../../src/usecases/phase34/detectDecisionDrift');

test('phase34 t03: policy drift is detected', async () => {
  const result = await detectDecisionDrift({
    decisionLog: { nextAction: 'NO_ACTION' },
    opsDecisionSnapshot: {
      readiness: { status: 'NOT_READY' },
      allowedNextActions: ['STOP_AND_ESCALATE'],
      selectedAction: 'NO_ACTION'
    },
    llmSuggestion: {
      suggestedNextActions: [
        { action: 'NO_ACTION', confidence: 0.4, rationale: 'hold', risk: 'delay' }
      ]
    },
    executionResult: { execution: { action: 'NO_ACTION', result: 'SUCCESS', sideEffects: ['no_action'] } }
  });

  assert.strictEqual(result.driftDetected, true);
  assert.ok(result.driftTypes.includes('POLICY_DRIFT'));
});

