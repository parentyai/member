'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getNotificationDeliveries } = require('../../src/usecases/deliveries/getNotificationDeliveries');

test('phase671: notification deliveries usecase requires lineUserId or memberNumber', async () => {
  await assert.rejects(
    () => getNotificationDeliveries({}, {}),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, 'lineUserId or memberNumber required');
      return true;
    }
  );
});

test('phase671: notification deliveries usecase resolves rows, joins metadata, and appends audit', async () => {
  const auditCalls = [];
  const deps = {
    usersRepo: {
      async listUsersByMemberNumber(memberNumber, limit) {
        assert.equal(memberNumber, 'MEM-671');
        assert.equal(limit, 20);
        return [
          { id: 'U671_A', memberNumber: 'MEM-671' },
          { id: 'U671_B', memberNumber: 'MEM-671' }
        ];
      }
    },
    deliveriesRepo: {
      async listDeliveriesByUser(lineUserId, limit) {
        assert.equal(limit, 2);
        if (lineUserId === 'U671_A') {
          return [{
            id: 'DEL_671_A',
            notificationId: 'N671_A',
            state: 'delivered',
            delivered: true,
            sentAt: '2026-02-26T10:00:00.000Z',
            deliveredAt: '2026-02-26T10:00:01.000Z',
            traceId: 'TRACE_DEL_A'
          }];
        }
        return [{
          id: 'DEL_671_B',
          notificationId: 'N671_B',
          state: 'failed',
          delivered: false,
          sentAt: '2026-02-26T09:00:00.000Z',
          lastError: 'LINE API returned 500'
        }];
      }
    },
    notificationsRepo: {
      async getNotification(id) {
        if (id === 'N671_A') {
          return {
            id,
            title: '通知A',
            scenarioKey: 'phase1.tax',
            stepKey: 'stepA',
            linkRegistryId: 'LINK_671_A'
          };
        }
        if (id === 'N671_B') {
          return {
            id,
            title: '通知B',
            scenarioKey: 'phase1.childcare',
            stepKey: 'stepB',
            linkRegistryId: 'LINK_671_B'
          };
        }
        return null;
      }
    },
    linkRegistryRepo: {
      async getLink(id) {
        if (id === 'LINK_671_A') {
          return {
            id,
            vendorKey: 'city.example.jp',
            vendorLabel: '市公式',
            url: 'https://city.example.jp/a'
          };
        }
        return {
          id,
          url: 'https://pref.example.jp/b'
        };
      }
    },
    appendAuditLog: async (entry) => {
      auditCalls.push(entry);
      return { id: 'AUDIT_671' };
    }
  };

  const result = await getNotificationDeliveries({
    memberNumber: 'MEM-671',
    limit: 2,
    traceId: 'TRACE_671',
    requestId: 'REQ_671',
    actor: 'phase671_test'
  }, deps);

  assert.equal(result.ok, true);
  assert.equal(result.traceId, 'TRACE_671');
  assert.equal(result.query.memberNumber, 'MEM-671');
  assert.deepEqual(result.query.resolvedLineUserIds, ['U671_A', 'U671_B']);
  assert.equal(result.items.length, 2);

  assert.equal(result.items[0].deliveryId, 'DEL_671_A');
  assert.equal(result.items[0].vendorKey, 'city.example.jp');
  assert.equal(result.items[0].statusLabel, '配信完了');
  assert.equal(result.items[0].health, 'OK');

  assert.equal(result.items[1].deliveryId, 'DEL_671_B');
  assert.equal(result.items[1].vendorKey, 'pref.example.jp');
  assert.equal(result.items[1].statusLabel, '送信失敗');
  assert.equal(result.items[1].health, 'DANGER');
  assert.ok(result.items[1].failureCode);

  assert.deepEqual(result.summary, {
    total: 2,
    danger: 1,
    warn: 0,
    ok: 1,
    unknown: 0
  });

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'notifications.deliveries.view');
  assert.equal(auditCalls[0].traceId, 'TRACE_671');
  assert.equal(auditCalls[0].requestId, 'REQ_671');
  assert.equal(auditCalls[0].entityType, 'notification_deliveries');
  assert.equal(auditCalls[0].payloadSummary.resolvedUsers, 2);
  assert.equal(auditCalls[0].payloadSummary.count, 2);
});
