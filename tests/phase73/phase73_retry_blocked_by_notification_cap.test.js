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

const sendRetryQueueRepo = require('../../src/repos/firestore/sendRetryQueueRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
const { planRetryQueuedSend } = require('../../src/usecases/phase73/planRetryQueuedSend');
const { retryQueuedSend } = require('../../src/usecases/phase73/retryQueuedSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase73: retry is blocked by per-user weekly cap', async () => {
  await systemFlagsRepo.setServicePhase(2);
  await systemFlagsRepo.setNotificationPreset('B');
  await systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 1 });

  await deliveriesRepo.createDeliveryWithId('d_prev_u1', {
    notificationId: 'n_prev',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-07T12:00:00.000Z',
    deliveredAt: '2026-02-07T12:00:00.000Z'
  });

  const queued = await sendRetryQueueRepo.enqueueFailure({
    lineUserId: 'U1',
    templateKey: 'ops_alert',
    payloadSnapshot: {
      lineUserId: 'U1',
      text: 'Body',
      notificationId: 'ops_alert',
      notificationCategory: 'SEQUENCE_GUIDANCE'
    },
    reason: 'send_failed'
  });

  const now = new Date('2026-02-08T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const plan = await planRetryQueuedSend({ queueId: queued.id, decidedBy: 'ops' }, { now, confirmTokenSecret });
  assert.strictEqual(plan.ok, true);

  let sendCount = 0;
  const result = await retryQueuedSend({
    queueId: queued.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  }, {
    now,
    confirmTokenSecret,
    sendFn: async () => { sendCount += 1; },
    getKillSwitch: async () => false
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'notification_cap_blocked');
  assert.strictEqual(result.status, 409);
  assert.strictEqual(sendCount, 0);

  const stored = await sendRetryQueueRepo.getQueueItem(queued.id);
  assert.strictEqual(stored.status, 'PENDING');
});
