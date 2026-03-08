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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { approveNotification } = require('../../src/usecases/adminOs/approveNotification');
const { planNotificationSend } = require('../../src/usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../src/usecases/adminOs/executeNotificationSend');
const { computeNotificationDeliveryId } = require('../../src/domain/deliveryId');

const ORIGINAL_SECRET = process.env.OPS_CONFIRM_TOKEN_SECRET;

beforeEach(() => {
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test-confirm-secret';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.OPS_CONFIRM_TOKEN_SECRET;
  } else {
    process.env.OPS_CONFIRM_TOKEN_SECRET = ORIGINAL_SECRET;
  }
});

test('phase161: push success + persistence failure does not trigger duplicate resend', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });

  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: 'week' });

  const created = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 50 },
    createdBy: 'admin_composer'
  });

  const approved = await approveNotification({ notificationId: created.id, actor: 'admin_composer' });
  assert.strictEqual(approved.ok, true);

  const plan = await planNotificationSend({
    notificationId: created.id,
    actor: 'admin_composer',
    traceId: 'TRACE_PERSIST_FAIL_1',
    requestId: 'REQ_1'
  }, { now: new Date('2026-02-10T00:00:00.000Z') });
  assert.strictEqual(plan.ok, true);

  const originalCreateDeliveryWithId = deliveriesRepo.createDeliveryWithId;
  let injected = false;
  deliveriesRepo.createDeliveryWithId = async (deliveryId, data) => {
    if (!injected && data && data.state === 'delivered' && data.delivered === true) {
      injected = true;
      throw new Error('persist_failed_after_push');
    }
    return originalCreateDeliveryWithId(deliveryId, data);
  };

  const firstSent = [];
  let first = null;
  try {
    first = await executeNotificationSend({
      notificationId: created.id,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken,
      actor: 'admin_composer',
      traceId: 'TRACE_PERSIST_FAIL_1',
      requestId: 'REQ_2'
    }, {
      now: new Date('2026-02-10T00:00:30.000Z'),
      getKillSwitch: async () => false,
      pushFn: async (lineUserId) => {
        firstSent.push(lineUserId);
        return { status: 200 };
      }
    });
  } finally {
    deliveriesRepo.createDeliveryWithId = originalCreateDeliveryWithId;
  }

  assert.strictEqual(first.ok, false);
  assert.strictEqual(first.partial, true);
  assert.strictEqual(first.reason, 'send_partial_failure');
  assert.deepStrictEqual(firstSent, ['U1']);

  const deliveryId = computeNotificationDeliveryId({ notificationId: created.id, lineUserId: 'U1' });
  const deliveryAfterFirst = await deliveriesRepo.getDelivery(deliveryId);
  assert.ok(deliveryAfterFirst);
  assert.strictEqual(deliveryAfterFirst.state, 'delivery_persist_failed_after_push');
  assert.strictEqual(Boolean(deliveryAfterFirst.lastError), false);

  const secondSent = [];
  const second = await executeNotificationSend({
    notificationId: created.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken,
    actor: 'admin_composer',
    traceId: 'TRACE_PERSIST_FAIL_1',
    requestId: 'REQ_3'
  }, {
    now: new Date('2026-02-10T00:02:00.000Z'),
    getKillSwitch: async () => false,
    pushFn: async (lineUserId) => {
      secondSent.push(lineUserId);
      return { status: 200 };
    }
  });

  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.deliveredCount, 0);
  assert.strictEqual(second.skippedCount, 1);
  assert.deepStrictEqual(secondSent, [], 'rerun should skip user to prevent duplicate send');

  const afterOk = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(afterOk.status, 'sent');
});
