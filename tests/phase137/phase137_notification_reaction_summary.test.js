'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getNotificationReactionSummary } = require('../../src/usecases/phase137/getNotificationReactionSummary');

test('phase137: notification reaction summary aggregates deliveries deterministically', async () => {
  const deliveries = [
    { id: 'd1', notificationId: 'n1', clickAt: null, readAt: null },
    { id: 'd2', notificationId: 'n1', clickAt: '2026-02-09T00:00:00.000Z', readAt: null },
    { id: 'd3', notificationId: 'n1', clickAt: null, readAt: '2026-02-10T00:00:00.000Z' },
    { id: 'd4', notificationId: 'n1', clickAt: '2026-02-11T00:00:00.000Z', readAt: '2026-02-09T01:00:00.000Z' }
  ];
  const result = await getNotificationReactionSummary({ notificationId: 'n1' }, {
    deliveriesRepo: { listDeliveriesByNotificationId: async (id) => deliveries.filter((d) => d.notificationId === id) }
  });

  assert.deepStrictEqual(result, {
    notificationId: 'n1',
    sent: 4,
    clicked: 2,
    read: 2,
    ctr: 0.5,
    lastReactionAt: '2026-02-11T00:00:00.000Z'
  });
});

test('phase137: ctr is 0 when sent is 0', async () => {
  const result = await getNotificationReactionSummary({ notificationId: 'n2' }, {
    deliveriesRepo: { listDeliveriesByNotificationId: async () => [] }
  });
  assert.strictEqual(result.sent, 0);
  assert.strictEqual(result.clicked, 0);
  assert.strictEqual(result.read, 0);
  assert.strictEqual(result.ctr, 0);
  assert.strictEqual(result.lastReactionAt, null);
});

