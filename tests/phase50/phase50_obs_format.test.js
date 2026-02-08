'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { emitObs } = require('../../src/ops/obs');

test('phase50: obs format is key=value and meta_json', () => {
  const messages = [];
  const line = emitObs({
    action: 'ops_console_get',
    result: 'ok',
    requestId: 'r1',
    lineUserId: 'U1',
    meta: {
      readiness: 'READY',
      count: 2,
      detail: { foo: 'bar' }
    },
    logger: (msg) => messages.push(msg)
  });

  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0], line);
  assert.strictEqual(
    line,
    '[OBS] action=ops_console_get result=ok requestId=r1 lineUserId=U1 count=2 readiness=READY meta_json={"detail":{"foo":"bar"}}'
  );
});
