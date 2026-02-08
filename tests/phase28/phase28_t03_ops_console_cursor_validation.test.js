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
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: 'not-base64' }, deps),
    /invalid cursor/
  );

  const badJson = Buffer.from('{"s":"READY"', 'utf8').toString('base64url');
  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: badJson }, deps),
    /invalid cursor/
  );

  const missingId = Buffer.from(JSON.stringify({ s: 'READY', t: null }), 'utf8').toString('base64url');
  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: missingId }, deps),
    /invalid cursor/
  );
});
