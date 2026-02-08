'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase29 t02: signed cursor is returned and can paginate without overlap (optional security)', async () => {
  const deps = {
    cursorSecret: 'test-secret',
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' },
      { id: 'U3' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      const updatedAtById = {
        U1: '2026-02-08T03:20:00.000Z',
        U2: '2026-02-08T03:10:00.000Z',
        U3: '2026-02-08T03:30:00.000Z'
      };
      const readinessStatus = lineUserId === 'U1' ? 'READY' : 'NOT_READY';
      return {
        readiness: { status: readinessStatus, blocking: readinessStatus === 'READY' ? [] : ['missing_ops_state'] },
        recommendedNextAction: readinessStatus === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE',
        allowedNextActions: [readinessStatus === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE'],
        opsState: { id: lineUserId, updatedAt: updatedAtById[lineUserId] }
      };
    }
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 1 }, deps);
  assert.strictEqual(page1.pageInfo.hasNext, true);
  assert.ok(page1.pageInfo.nextCursor);
  assert.ok(page1.pageInfo.nextCursor.includes('.'));
  assert.strictEqual(page1.nextPageToken, page1.pageInfo.nextCursor);

  const page2 = await listOpsConsole({ status: 'ALL', limit: 1, cursor: page1.nextPageToken }, deps);
  const page3 = await listOpsConsole({ status: 'ALL', limit: 1, cursor: page2.nextPageToken }, deps);

  const ids = page1.items.concat(page2.items).concat(page3.items).map((item) => item.lineUserId);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size);
});

