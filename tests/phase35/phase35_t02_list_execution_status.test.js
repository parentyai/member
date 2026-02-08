'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase35 t02: list includes executionStatus summary', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE'],
      executionStatus: {
        lastExecutionResult: 'OK',
        lastExecutedAt: '2026-02-08T02:00:00Z'
      }
    })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.strictEqual(result.items[0].executionStatus.lastExecutionResult, 'OK');
  assert.strictEqual(result.items[0].executionStatus.lastExecutedAt, '2026-02-08T02:00:00.000Z');
});

test('phase35 t02: list defaults executionStatus when missing', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U2' }]),
    getOpsConsole: async () => ({})
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.deepStrictEqual(result.items[0].executionStatus, {
    lastExecutionResult: 'UNKNOWN',
    lastExecutedAt: null
  });
});
