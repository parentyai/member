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
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');

const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');
const { planRetryQueuedSend } = require('../../src/usecases/phase73/planRetryQueuedSend');
const { retryQueuedSend } = require('../../src/usecases/phase73/retryQueuedSend');
const { computeNotificationDeliveryId } = require('../../src/domain/deliveryId');

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
  const now = new Date('2026-02-08T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const plan = await planRetryQueuedSend({ queueId: enq.id, decidedBy: 'ops' }, { now, confirmTokenSecret });
  assert.strictEqual(plan.ok, true);

  const res = await retryQueuedSend({
    queueId: enq.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  }, {
    now,
    confirmTokenSecret,
    getKillSwitch: async () => false,
    sendFn: async (payload) => {
      seenDeliveryId = payload.deliveryId || null;
      return { id: payload.deliveryId || 'x' };
    }
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(seenDeliveryId, 'd_retry_1');
});

test('phase72: testSendNotification skips sealed deliveryId without pushing', async () => {
  const deliveryId = 'd_sealed_1';
  await deliveriesRepo.createDeliveryWithId(deliveryId, {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: false,
    sealed: true,
    state: 'sealed'
  });

  let pushCount = 0;
  const result = await testSendNotification({
    lineUserId: 'U1',
    text: 'hello',
    notificationId: 'n1',
    deliveryId,
    killSwitch: false,
    pushFn: async () => { pushCount += 1; }
  });

  assert.strictEqual(result.skipped, true);
  assert.strictEqual(pushCount, 0);
});

test('phase72: sendNotification skips sealed delivery and does not push duplicate', async () => {
  const link = await linkRegistryRepo.createLink({ title: 'LinkA', url: 'https://example.com/a' });
  await usersRepo.createUser('U1', { scenarioKey: 'ops', stepKey: 's1' });
  const created = await notificationsRepo.createNotification({
    title: 'Notice',
    body: 'Body',
    ctaText: 'openA',
    linkRegistryId: link.id,
    scenarioKey: 'ops',
    stepKey: 's1',
    target: { limit: 10 },
    status: 'active'
  });
  const deliveryId = computeNotificationDeliveryId({ notificationId: created.id, lineUserId: 'U1' });
  await deliveriesRepo.createDeliveryWithId(deliveryId, {
    notificationId: created.id,
    lineUserId: 'U1',
    delivered: false,
    sealed: true,
    state: 'sealed'
  });

  let pushCount = 0;
  const result = await sendNotification({
    notificationId: created.id,
    pushFn: async () => { pushCount += 1; }
  });

  assert.strictEqual(pushCount, 0);
  assert.strictEqual(result.deliveredCount, 0);
  assert.strictEqual(result.skippedCount, 1);
});
