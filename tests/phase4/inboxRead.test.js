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

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { markInboxRead } = require('../../src/usecases/mini/markInboxRead');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('T1');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('markInboxRead: sets readAt on first read', async () => {
  const delivery = await deliveriesRepo.createDelivery({ notificationId: 'n1', lineUserId: 'U1' });
  await markInboxRead({ lineUserId: 'U1', deliveryId: delivery.id });
  const stored = await deliveriesRepo.getDelivery(delivery.id);
  assert.strictEqual(stored.readAt, 'T1');
});

test('markInboxRead: does not overwrite existing readAt', async () => {
  const delivery = await deliveriesRepo.createDelivery({ notificationId: 'n2', lineUserId: 'U1' });
  await markInboxRead({ lineUserId: 'U1', deliveryId: delivery.id });
  setServerTimestampForTest('T2');
  await markInboxRead({ lineUserId: 'U1', deliveryId: delivery.id });
  const stored = await deliveriesRepo.getDelivery(delivery.id);
  assert.strictEqual(stored.readAt, 'T1');
});
