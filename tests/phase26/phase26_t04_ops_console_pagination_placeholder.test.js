'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase26 t04: list returns pageInfo placeholder', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async ({ lineUserId }) => ({
      lineUserId,
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION'],
      opsState: { id: lineUserId, updatedAt: '2026-02-08T02:40:00.000Z' },
      latestDecisionLog: { id: 'd1', decidedAt: '2026-02-08T02:39:00.000Z' }
    })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.ok(result.pageInfo);
  assert.strictEqual(typeof result.pageInfo.hasNext, 'boolean');
  assert.strictEqual(result.pageInfo.hasNext, false);
  assert.strictEqual(result.pageInfo.nextCursor, null);
});

test('phase26 t04: list returns pageInfo even when empty', async () => {
  const deps = {
    listUsers: async () => ([]),
    getOpsConsole: async () => ({ readiness: { status: 'READY', blocking: [] } })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.ok(result.pageInfo);
  assert.strictEqual(result.pageInfo.hasNext, false);
  assert.strictEqual(result.pageInfo.nextCursor, null);
  assert.deepStrictEqual(result.items, []);
});
