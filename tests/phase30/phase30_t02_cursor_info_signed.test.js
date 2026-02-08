'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase30 t02: cursorInfo reflects signing/enforce even when items empty', async () => {
  const deps = {
    cursorSecret: 'phase30-secret',
    cursorEnforce: true,
    listUsers: async () => ([])
  };

  const result = await listOpsConsole({ status: 'ALL', limit: 10 }, deps);
  assert.ok(result.pageInfo);
  assert.ok(result.pageInfo.cursorInfo);
  assert.strictEqual(result.pageInfo.cursorInfo.mode, 'SIGNED');
  assert.strictEqual(result.pageInfo.cursorInfo.enforce, true);
});

