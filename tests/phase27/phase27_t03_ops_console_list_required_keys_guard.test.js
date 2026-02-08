'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase27 t03: list guards required keys/types when console result is missing fields', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({})
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);

  assert.strictEqual(result.ok, true);
  assert.ok(Array.isArray(result.items));
  assert.strictEqual(result.items.length, 1);

  const item = result.items[0];
  assert.strictEqual(item.lineUserId, 'U1');
  assert.ok(item.readiness);
  assert.strictEqual(item.readiness.status, 'NOT_READY');
  assert.ok(Array.isArray(item.readiness.blocking));
  assert.strictEqual(typeof item.recommendedNextAction, 'string');
  assert.ok(Array.isArray(item.allowedNextActions));
  assert.ok(item.allowedNextActions.includes('STOP_AND_ESCALATE'));
  assert.strictEqual(item.opsState, null);
  assert.strictEqual(item.latestDecisionLog, null);
});
