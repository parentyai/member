'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildSendSegment } = require('../../src/usecases/phase66/buildSendSegment');

test('phase66: segment uses lineUserIds override', async () => {
  const deps = {
    listOpsConsole: async () => {
      throw new Error('listOpsConsole should not be called');
    }
  };

  const result = await buildSendSegment({
    lineUserIds: ['U1', 'U2', 'U1'],
    limit: 1
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].lineUserId, 'U1');
  assert.strictEqual(result.items[0].readiness, null);
});
