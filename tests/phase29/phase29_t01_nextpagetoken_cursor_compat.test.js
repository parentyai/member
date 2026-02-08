'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor)', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' },
      { id: 'U3' },
      { id: 'U4' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      const updatedAtById = {
        U1: '2026-02-08T03:20:00.000Z',
        U2: '2026-02-08T03:10:00.000Z',
        U3: '2026-02-08T03:30:00.000Z',
        U4: '2026-02-08T03:00:00.000Z'
      };
      const readinessStatus = lineUserId === 'U1' || lineUserId === 'U2' ? 'READY' : 'NOT_READY';
      return {
        readiness: { status: readinessStatus, blocking: readinessStatus === 'READY' ? [] : ['missing_ops_state'] },
        recommendedNextAction: readinessStatus === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE',
        allowedNextActions: [readinessStatus === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE'],
        opsState: { id: lineUserId, updatedAt: updatedAtById[lineUserId] }
      };
    }
  };

  const page1 = await listOpsConsole({ status: 'ALL', limit: 2 }, deps);
  assert.strictEqual(page1.pageInfo.hasNext, true);
  assert.ok(page1.pageInfo.nextCursor);
  assert.strictEqual(page1.nextPageToken, page1.pageInfo.nextCursor);

  const page2 = await listOpsConsole({ status: 'ALL', limit: 2, cursor: page1.nextPageToken }, deps);
  assert.strictEqual(page2.pageInfo.hasNext, false);

  const page1Ids = page1.items.map((item) => item.lineUserId);
  const page2Ids = page2.items.map((item) => item.lineUserId);
  const overlap = page1Ids.filter((id) => page2Ids.includes(id));
  assert.deepStrictEqual(overlap, []);
});

