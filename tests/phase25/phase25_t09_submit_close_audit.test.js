'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase25 t09: audit includes closeDecision fields', async () => {
  const consoleResult = {
    readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
    consistency: { status: 'OK', issues: [] },
    allowedNextActions: ['STOP_AND_ESCALATE'],
    recommendedNextAction: 'STOP_AND_ESCALATE',
    closeDecision: 'NO_CLOSE',
    closeReason: 'readiness_not_ready',
    phaseResult: 'NOT_READY',
    serverTime: '2026-02-08T00:00:00.000Z'
  };

  const deps = {
    getOpsConsole: async () => consoleResult,
    recordOpsNextAction: async (input) => ({
      decisionLogId: 'd1',
      opsState: {
        id: input.lineUserId,
        nextAction: input.nextAction,
        sourceDecisionLogId: 'd1'
      }
    })
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'IMPL' },
    decidedBy: 'ops'
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.audit.closeDecision, 'NO_CLOSE');
  assert.strictEqual(result.audit.closeReason, 'readiness_not_ready');
  assert.strictEqual(result.audit.phaseResult, 'NOT_READY');
});
