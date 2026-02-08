'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase26 t01: list splits READY/NOT_READY and returns required keys', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      const readiness = lineUserId === 'U1'
        ? { status: 'READY', blocking: [] }
        : { status: 'NOT_READY', blocking: ['missing_ops_state'] };
      return {
        lineUserId,
        readiness,
        recommendedNextAction: readiness.status === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE',
        allowedNextActions: readiness.status === 'READY'
          ? ['NO_ACTION', 'STOP_AND_ESCALATE']
          : ['STOP_AND_ESCALATE'],
        opsState: { id: lineUserId, nextAction: readiness.status === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE' },
        latestDecisionLog: { id: `${lineUserId}_d1` }
      };
    }
  };

  const readyResult = await listOpsConsole({ status: 'READY', limit: 50 }, deps);
  assert.strictEqual(readyResult.ok, true);
  assert.ok(typeof readyResult.serverTime === 'string');
  assert.strictEqual(readyResult.items.length, 1);
  assert.strictEqual(readyResult.items[0].lineUserId, 'U1');
  assert.ok(readyResult.items[0].readiness);
  assert.ok(Array.isArray(readyResult.items[0].allowedNextActions));

  const notReadyResult = await listOpsConsole({ status: 'NOT_READY', limit: 50 }, deps);
  assert.strictEqual(notReadyResult.items.length, 1);
  assert.strictEqual(notReadyResult.items[0].lineUserId, 'U2');

  const allResult = await listOpsConsole({ status: 'ALL', limit: 50 }, deps);
  assert.strictEqual(allResult.items.length, 2);
  for (const item of allResult.items) {
    assert.ok(item.lineUserId);
    assert.ok(item.readiness);
    assert.ok(typeof item.recommendedNextAction === 'string');
    assert.ok(Array.isArray(item.allowedNextActions));
  }
});
