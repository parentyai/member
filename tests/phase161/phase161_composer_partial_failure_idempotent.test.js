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

test('phase161: partial send failure -> rerun executes remaining only (no double-send)', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });

  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: 'week' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: 'week' });

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
    traceId: 'TRACE_PARTIAL_1',
    requestId: 'REQ_1'
  }, { now: new Date('2026-02-10T00:00:00.000Z') });
  assert.strictEqual(plan.ok, true);

  const firstSent = [];
  let firstErr = null;
  try {
    await executeNotificationSend({
      notificationId: created.id,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken,
      actor: 'admin_composer',
      traceId: 'TRACE_PARTIAL_1',
      requestId: 'REQ_2'
    }, {
      now: new Date('2026-02-10T00:00:30.000Z'),
      getKillSwitch: async () => false,
      pushFn: async (lineUserId) => {
        firstSent.push(lineUserId);
        if (lineUserId === 'U2') throw new Error('push_failed');
        return { status: 200 };
      }
    });
  } catch (err) {
    firstErr = err;
  }
  assert.ok(firstErr, 'expected first execute to throw');

  const afterFail = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(afterFail.status, 'active', 'should remain active when send fails');

  const d1 = computeNotificationDeliveryId({ notificationId: created.id, lineUserId: 'U1' });
  const delivery1 = await deliveriesRepo.getDelivery(d1);
  assert.ok(delivery1 && delivery1.delivered);

  const secondSent = [];
  const exec2 = await executeNotificationSend({
    notificationId: created.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken,
    actor: 'admin_composer',
    traceId: 'TRACE_PARTIAL_1',
    requestId: 'REQ_3'
  }, {
    now: new Date('2026-02-10T00:02:00.000Z'),
    getKillSwitch: async () => false,
    pushFn: async (lineUserId) => {
      secondSent.push(lineUserId);
      return { status: 200 };
    }
  });

  assert.strictEqual(exec2.ok, true);
  assert.strictEqual(exec2.deliveredCount, 1);
  assert.strictEqual(exec2.skippedCount, 1);
  assert.deepStrictEqual(secondSent, ['U2'], 'rerun should only send remaining recipient');

  const afterOk = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(afterOk.status, 'sent');
});

