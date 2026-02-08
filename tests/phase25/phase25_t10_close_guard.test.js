'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase25 t10: CLOSE rejects submit', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK', issues: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      recommendedNextAction: 'NO_ACTION',
      closeDecision: 'CLOSE'
    }),
    recordOpsNextAction: async () => {
      throw new Error('should not write');
    }
  };

  await assert.rejects(
    () => submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'NO_ACTION', failure_class: 'IMPL' },
      decidedBy: 'ops'
    }, deps),
    /closeDecision closed/
  );
});

test('phase25 t10: NO_CLOSE rejects non-escalate actions', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
      consistency: { status: 'OK', issues: [] },
      allowedNextActions: ['STOP_AND_ESCALATE'],
      recommendedNextAction: 'STOP_AND_ESCALATE',
      closeDecision: 'NO_CLOSE'
    }),
    recordOpsNextAction: async () => {
      throw new Error('should not write');
    }
  };

  await assert.rejects(
    () => submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'FIX_AND_RERUN', failure_class: 'IMPL' },
      decidedBy: 'ops'
    }, deps),
    /closeDecision: NO_CLOSE/
  );
});
