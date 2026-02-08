'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase28 t03: invalid cursor is rejected', async () => {
  const deps = {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION']
    })
  };

  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: 'not-a-cursor' }, deps),
    /invalid cursor/
  );

  const badJson = Buffer.from('{"v":1', 'utf8').toString('base64url');
  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: `v1.${badJson}` }, deps),
    /invalid cursor/
  );

  const missingId = Buffer.from(JSON.stringify({ v: 1, lastSortKey: { readinessRank: 0 }, issuedAt: 1 }), 'utf8')
    .toString('base64url');
  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: `v1.${missingId}` }, deps),
    /invalid cursor/
  );
});
