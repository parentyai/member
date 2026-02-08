'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION'],
      opsState: { id: 'U1', updatedAt: '2026-02-08T04:00:00.000Z' }
    })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 10 }, deps);
  assert.ok(result.pageInfo);
  assert.ok(result.pageInfo.cursorInfo);
  assert.strictEqual(result.pageInfo.cursorInfo.mode, 'UNSIGNED');
  assert.strictEqual(result.pageInfo.cursorInfo.enforce, false);
});

