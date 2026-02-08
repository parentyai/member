'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

function decodeCursor(value) {
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  return JSON.parse(decoded);
}

test('phase28 t02: pagination returns page1/page2 without overlap and stable order', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' },
      { id: 'U3' },
      { id: 'U4' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      if (lineUserId === 'U1') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U1', updatedAt: '2026-02-08T03:20:00.000Z' }
        };
      }
      if (lineUserId === 'U2') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U2', updatedAt: '2026-02-08T03:10:00.000Z' }
        };
      }
      if (lineUserId === 'U3') {
        return {
          readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
          recommendedNextAction: 'STOP_AND_ESCALATE',
          allowedNextActions: ['STOP_AND_ESCALATE'],
          opsState: { id: 'U3', updatedAt: '2026-02-08T03:30:00.000Z' }
        };
      }
      return {
        readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
        recommendedNextAction: 'STOP_AND_ESCALATE',
        allowedNextActions: ['STOP_AND_ESCALATE'],
        opsState: { id: 'U4', updatedAt: '2026-02-08T03:00:00.000Z' }
      };
    }
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 2 }, deps);
  assert.strictEqual(page1.items.length, 2);
  assert.strictEqual(page1.pageInfo.hasNext, true);
  assert.ok(page1.pageInfo.nextCursor);

  const page2 = await listOpsConsole({ status: 'ALL', limit: 2, cursor: page1.pageInfo.nextCursor }, deps);
  assert.strictEqual(page2.items.length, 2);
  assert.strictEqual(page2.pageInfo.hasNext, false);

  const page1Ids = page1.items.map((item) => item.lineUserId);
  const page2Ids = page2.items.map((item) => item.lineUserId);
  const overlap = page1Ids.filter((id) => page2Ids.includes(id));
  assert.deepStrictEqual(overlap, []);

  const combined = page1Ids.concat(page2Ids);
  assert.deepStrictEqual(combined, ['U1', 'U2', 'U3', 'U4']);

  const cursorPayload = decodeCursor(page1.pageInfo.nextCursor);
  assert.ok(['READY', 'NOT_READY'].includes(cursorPayload.s));
  assert.ok(typeof cursorPayload.id === 'string');
});
