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
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { approveNotification } = require('../../src/usecases/adminOs/approveNotification');
const { planNotificationSend } = require('../../src/usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../src/usecases/adminOs/executeNotificationSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase161: composer flow draft -> approve -> plan -> execute (no real send)', async () => {
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
  const afterApprove = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(afterApprove.status, 'active');

  const plan = await planNotificationSend({
    notificationId: created.id,
    actor: 'admin_composer',
    traceId: 'TRACE_1',
    requestId: 'REQ_1'
  }, { now: new Date('2026-02-10T00:00:00.000Z') });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.count, 2);
  assert.ok(plan.planHash);
  assert.ok(plan.confirmToken);

  const sentTo = [];
  const exec = await executeNotificationSend({
    notificationId: created.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken,
    actor: 'admin_composer',
    traceId: 'TRACE_1',
    requestId: 'REQ_2'
  }, {
    now: new Date('2026-02-10T00:00:30.000Z'),
    getKillSwitch: async () => false,
    pushFn: async (lineUserId) => {
      sentTo.push(lineUserId);
      return { status: 200 };
    }
  });

  assert.strictEqual(exec.ok, true);
  assert.strictEqual(exec.deliveredCount, 2);
  assert.strictEqual(sentTo.length, 2);

  const updated = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(updated.status, 'sent');

  const listDeliveries = await deliveriesRepo.listDeliveriesByNotificationId(created.id);
  assert.strictEqual(listDeliveries.length, 2);

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_1', 50);
  const actions = audits.map((a) => a.action).filter(Boolean);
  assert.ok(actions.includes('notifications.send.plan'));
  assert.ok(actions.includes('notifications.send.execute'));
});
