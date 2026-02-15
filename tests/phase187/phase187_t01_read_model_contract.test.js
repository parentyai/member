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

test('phase187 t01: read-model keys required by monitor/read_model', async () => {
  const notification = await notificationsRepo.createNotification({
    title: 'Title',
    scenarioKey: 'A',
    stepKey: '3mo'
  });
  await deliveriesRepo.createDelivery({ notificationId: notification.id, lineUserId: 'U1', readAt: 'R1' });
  await deliveriesRepo.createDelivery({ notificationId: notification.id, lineUserId: 'U2', clickAt: 'C1' });

  const result = await getNotificationReadModel();
  assert.strictEqual(result.length, 1);
  const item = result[0];
  const requiredKeys = [
    'notificationId',
    'title',
    'scenarioKey',
    'stepKey',
    'deliveredCount',
    'readCount',
    'clickCount',
    'reactionSummary',
    'notificationHealth'
  ];
  for (const key of requiredKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(item, key), `missing key: ${key}`);
  }
  assert.ok(item.reactionSummary && typeof item.reactionSummary === 'object');
  assert.ok(Object.prototype.hasOwnProperty.call(item.reactionSummary, 'ctr'));
});
