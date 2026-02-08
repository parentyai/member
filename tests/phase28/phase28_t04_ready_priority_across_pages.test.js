'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase28 t04: READY priority holds across pages', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' },
      { id: 'U3' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      if (lineUserId === 'U1') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U1', updatedAt: '2026-02-08T03:40:00.000Z' }
        };
      }
      if (lineUserId === 'U2') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          opsState: { id: 'U2', updatedAt: '2026-02-08T03:30:00.000Z' }
        };
      }
      return {
        readiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
        recommendedNextAction: 'STOP_AND_ESCALATE',
        allowedNextActions: ['STOP_AND_ESCALATE'],
        opsState: { id: 'U3', updatedAt: '2026-02-08T03:50:00.000Z' }
      };
    }
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 1 }, deps);
  const page2 = await listOpsConsole({ status: 'ALL', limit: 1, cursor: page1.pageInfo.nextCursor }, deps);
  const page3 = await listOpsConsole({ status: 'ALL', limit: 1, cursor: page2.pageInfo.nextCursor }, deps);

  assert.strictEqual(page1.items[0].readiness.status, 'READY');
  assert.strictEqual(page2.items[0].readiness.status, 'READY');
  assert.strictEqual(page3.items[0].readiness.status, 'NOT_READY');
});
