'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

function encodeUnsignedCursor(payload) {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

test('phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor', async () => {
  const baseDeps = {
    cursorSecret: 'test-secret',
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' }
    ]),
    getOpsConsole: async ({ lineUserId }) => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION'],
      opsState: { id: lineUserId, updatedAt: lineUserId === 'U1' ? '2026-02-08T03:20:00.000Z' : '2026-02-08T03:10:00.000Z' }
    })
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 1 }, baseDeps);
  const token = page1.nextPageToken;
  const parts = String(token).split('.');
  assert.strictEqual(parts.length, 2);
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  const flipped = sigB64.slice(0, -1) + (sigB64.slice(-1) === 'a' ? 'b' : 'a');
  const badToken = `${payloadB64}.${flipped}`;

  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 1, cursor: badToken }, baseDeps),
    /invalid cursor/
  );

  const enforceDeps = { ...baseDeps, cursorEnforce: true };
  const unsigned = encodeUnsignedCursor({ s: 'READY', t: '2026-02-08T03:20:00.000Z', id: 'U1' });
  await assert.rejects(
    () => listOpsConsole({ status: 'ALL', limit: 1, cursor: unsigned }, enforceDeps),
    /invalid cursor/
  );

  const enforcePage1 = await listOpsConsole({ status: 'ALL', limit: 1 }, enforceDeps);
  const enforcePage2 = await listOpsConsole(
    { status: 'ALL', limit: 1, cursor: enforcePage1.nextPageToken },
    enforceDeps
  );
  assert.strictEqual(enforcePage2.ok, true);
});

