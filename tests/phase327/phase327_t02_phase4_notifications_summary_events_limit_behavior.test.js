'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { getNotificationOperationalSummary } = require('../../src/usecases/admin/getNotificationOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase327: notification operational summary accepts bounded eventsLimit', async () => {
  const n1 = await notificationsRepo.createNotification({ title: 'N1', sentAt: '2026-01-01T00:00:00Z' });
  setServerTimestampForTest('2026-01-02T00:00:00Z');
  const n2 = await notificationsRepo.createNotification({ title: 'N2', sentAt: '2026-01-02T00:00:00Z' });

  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'open', ref: { notificationId: n1.id } });
  await eventsRepo.createEvent({ lineUserId: 'U2', type: 'open', ref: { notificationId: n2.id } });

  const items = await getNotificationOperationalSummary({
    limit: 1,
    eventsLimit: 1
  });

  assert.strictEqual(items.length, 1);
});
