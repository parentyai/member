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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('getNotificationReadModel: counts delivered/read/click', async () => {
  const notification = await notificationsRepo.createNotification({
    title: 'Title',
    scenarioKey: 'A',
    stepKey: '3mo'
  });
  await deliveriesRepo.createDelivery({ notificationId: notification.id, lineUserId: 'U1', readAt: 'R1' });
  await deliveriesRepo.createDelivery({ notificationId: notification.id, lineUserId: 'U2', clickAt: 'C1' });
  await deliveriesRepo.createDelivery({
    notificationId: notification.id,
    lineUserId: 'U3',
    readAt: 'R2',
    clickAt: 'C2'
  });

  const result = await getNotificationReadModel();
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].deliveredCount, 3);
  assert.strictEqual(result[0].readCount, 2);
  assert.strictEqual(result[0].clickCount, 2);
});
