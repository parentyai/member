'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase28 t05: required keys are present on all pages', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }, { id: 'U2' }]),
    getOpsConsole: async () => ({})
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 1 }, deps);
  const page2 = await listOpsConsole({ status: 'ALL', limit: 1, cursor: page1.pageInfo.nextCursor }, deps);

  for (const page of [page1, page2]) {
    const item = page.items[0];
    assert.ok(item.lineUserId);
    assert.ok(item.readiness);
    assert.ok(Array.isArray(item.readiness.blocking));
    assert.strictEqual(typeof item.recommendedNextAction, 'string');
    assert.ok(Array.isArray(item.allowedNextActions));
    assert.ok(Object.prototype.hasOwnProperty.call(page, 'nextPageToken'));
    assert.ok(page.pageInfo);
  }
});
