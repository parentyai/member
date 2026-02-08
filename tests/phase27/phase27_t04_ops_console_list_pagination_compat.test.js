'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo)', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION']
    })
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'nextPageToken'));
  assert.strictEqual(result.nextPageToken, null);
  assert.ok(result.pageInfo);
  assert.strictEqual(result.pageInfo.hasNext, false);
  assert.strictEqual(result.pageInfo.nextCursor, null);
});

test('phase27 t04: list returns pagination keys even when items is empty', async () => {
  const deps = {
    listUsers: async () => ([]),
    getOpsConsole: async () => ({})
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.deepStrictEqual(result.items, []);
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'nextPageToken'));
  assert.strictEqual(result.nextPageToken, null);
  assert.ok(result.pageInfo);
  assert.strictEqual(result.pageInfo.hasNext, false);
  assert.strictEqual(result.pageInfo.nextCursor, null);
});
