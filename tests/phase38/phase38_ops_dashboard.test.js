'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsDashboard } = require('../../src/usecases/phase38/getOpsDashboard');

test('phase38: ops dashboard returns dashboard items', async () => {
  const deps = {
    usersRepo: {
      listUsers: async () => ([
        { id: 'U1', memberNumber: 'M1' },
        { id: 'U2', memberNumber: null }
      ])
    },
    deliveriesRepo: {
      listDeliveriesByUser: async (lineUserId) => {
        if (lineUserId === 'U1') {
          return [{ id: 'd1', noticeId: 'n1' }];
        }
        return [];
      }
    },
    noticesRepo: {
      listNotices: async () => ([{ id: 'n1', status: 'active' }])
    },
    decisionLogsRepo: {
      getLatestDecision: async (_type, lineUserId) => ({ id: `dec-${lineUserId}` })
    }
  };

  const result = await getOpsDashboard({ limit: 2 }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.items[0].lineUserId, 'U1');
  assert.strictEqual(result.items[0].lastNoticeSent.noticeId, 'n1');
  assert.strictEqual(result.items[1].lastDelivery, null);
});
