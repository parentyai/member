'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { signCursor } = require('../../src/domain/cursorSigning');
const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase80: list rejects tampered signed cursor', async () => {
  const signed = signCursor('2026-02-08T00:00:00.000Z', 'secret', false);
  const tampered = signed.slice(0, -2) + 'aa';
  const deps = {
    cursorSigningSecret: 'secret',
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION']
    })
  };

  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 2, cursor: tampered }, deps),
    /invalid cursor/
  );
});
