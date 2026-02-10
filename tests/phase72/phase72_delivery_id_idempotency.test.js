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
const sendRetryQueueRepo = require('../../src/repos/firestore/sendRetryQueueRepo');

const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');
const { retryQueuedSend } = require('../../src/usecases/phase73/retryQueuedSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase72: testSendNotification with deliveryId is idempotent (second call skips push)', async () => {
  const sentTo = [];
  const deliveryId = 'd_fixed_1';

  const r1 = await testSendNotification({
    lineUserId: 'U1',
    text: 'hello',
    notificationId: 'n1',
    deliveryId,
    killSwitch: false,
    pushFn: async (lineUserId) => {
      sentTo.push(lineUserId);
      return { status: 200 };
    }
  });
  assert.strictEqual(r1.id, deliveryId);
  assert.strictEqual(sentTo.length, 1);

  const r2 = await testSendNotification({
    lineUserId: 'U1',
    text: 'hello',
    notificationId: 'n1',
    deliveryId,
    killSwitch: false,
    pushFn: async (lineUserId) => {
      sentTo.push(lineUserId);
      return { status: 200 };
    }
  });
  assert.strictEqual(r2.id, deliveryId);
  assert.strictEqual(r2.skipped, true);
  assert.strictEqual(sentTo.length, 1, 'second call must not push again');

  const delivery = await deliveriesRepo.getDelivery(deliveryId);
  assert.ok(delivery);
  assert.strictEqual(delivery.delivered, true);
});

test('phase72: retryQueuedSend passes through deliveryId to sendFn', async () => {
  const enq = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U2',
    templateKey: 'tpl1',
    payloadSnapshot: {
      lineUserId: 'U2',
      notificationId: 'tpl1',
      text: 'hi',
      deliveryId: 'd_retry_1'
    },
    reason: 'send_failed',
    status: 'PENDING'
  });

  let seenDeliveryId = null;
  const res = await retryQueuedSend({ queueId: enq.id }, {
    getKillSwitch: async () => false,
    sendFn: async (payload) => {
      seenDeliveryId = payload.deliveryId || null;
      return { id: payload.deliveryId || 'x' };
    }
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(seenDeliveryId, 'd_retry_1');
});

