'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const usersRepo = require('../../src/repos/firestore/usersRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { getInbox } = require('../../src/usecases/mini/getInbox');
const { getChecklist } = require('../../src/usecases/mini/getChecklist');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('getInbox: returns deliveries with notification data', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });
  const notification = await notificationsRepo.createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: 'link1',
    scenarioKey: 'A',
    stepKey: '3mo',
    status: 'sent'
  });
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: notification.id,
    lineUserId: 'U1',
    sentAt: 'NOW',
    delivered: true
  });

  const items = await getInbox({ lineUserId: 'U1' });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].deliveryId, delivery.id);
  assert.strictEqual(items[0].title, 'Title');
});

test('getChecklist: returns items for scenario/step', async () => {
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo' });
  const result = await getChecklist({ lineUserId: 'U2' });
  assert.strictEqual(result.scenarioKey, 'A');
  assert.strictEqual(result.stepKey, '3mo');
  assert.ok(result.items.length > 0);
});
