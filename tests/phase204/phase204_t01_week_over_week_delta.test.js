'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase204: weekOverWeek delta is computed from deliveries', async () => {
  const notif = await notificationsRepo.createNotification({
    title: 't',
    body: 'b',
    ctaText: 'open',
    linkRegistryId: 'l1',
    scenarioKey: 's1',
    stepKey: 'st1',
    status: 'sent',
    createdAt: 1
  });

  await deliveriesRepo.createDelivery({
    notificationId: notif.id,
    lineUserId: 'U1',
    sentAt: '2026-02-15T00:00:00Z',
    clickAt: '2026-02-15T00:00:10Z'
  });
  await deliveriesRepo.createDelivery({
    notificationId: notif.id,
    lineUserId: 'U2',
    sentAt: '2026-02-14T00:00:00Z',
    readAt: '2026-02-14T00:00:10Z'
  });
  await deliveriesRepo.createDelivery({
    notificationId: notif.id,
    lineUserId: 'U3',
    sentAt: '2026-02-03T00:00:00Z',
    readAt: '2026-02-03T00:00:10Z'
  });

  const now = new Date('2026-02-16T00:00:00Z');
  const items = await getNotificationReadModel({ limit: 10, now });
  assert.strictEqual(items.length, 1);
  const item = items[0];

  assert.ok(item.weekOverWeek);
  assert.strictEqual(item.weekOverWeek.windowDays, 7);
  assert.deepStrictEqual(item.weekOverWeek.delta, {
    sent: 1,
    read: 0,
    click: 1,
    ctr: 0.5
  });
});
