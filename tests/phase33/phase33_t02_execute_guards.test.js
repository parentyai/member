'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

test('phase33 t02: duplicate execution is blocked', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION']
    }),
    decisionLogsRepo: {
      listDecisions: async () => ([{ id: 'exec-1' }]),
      getDecisionById: async () => ({ id: 'd1' }),
      appendDecision: async () => ({ id: 'exec-1' })
    }
  };

  await assert.rejects(
    () => executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'NO_ACTION' }, deps),
    /already executed/
  );
});

test('phase33 t02: readiness NOT_READY blocks execution', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing'] },
      allowedNextActions: ['STOP_AND_ESCALATE']
    }),
    decisionLogsRepo: {
      listDecisions: async () => ([]),
      getDecisionById: async () => ({ id: 'd1' }),
      appendDecision: async () => ({ id: 'exec-1' })
    }
  };

  await assert.rejects(
    () => executeOpsNextAction({ lineUserId: 'U1', decisionLogId: 'd1', action: 'STOP_AND_ESCALATE' }, deps),
    /readiness not ready/
  );
});

