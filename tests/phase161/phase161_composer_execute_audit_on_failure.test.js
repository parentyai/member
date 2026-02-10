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

test('phase161: execute failure writes notifications.send.execute audit with ok=false', async () => {
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
    traceId: 'TRACE_FAIL_1',
    requestId: 'REQ_1'
  }, { now: new Date('2026-02-10T00:00:00.000Z') });
  assert.strictEqual(plan.ok, true);

  let thrown = null;
  try {
    await executeNotificationSend({
      notificationId: created.id,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken,
      actor: 'admin_composer',
      traceId: 'TRACE_FAIL_1',
      requestId: 'REQ_2'
    }, {
      now: new Date('2026-02-10T00:00:30.000Z'),
      getKillSwitch: async () => false,
      pushFn: async () => {
        throw new Error('push_failed');
      }
    });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, 'expected execute to throw');

  const after = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(after.status, 'active', 'notification should not be marked sent on failure');

  const deliveries = await deliveriesRepo.listDeliveriesByNotificationId(created.id);
  assert.strictEqual(deliveries.length, 1, 'delivery should be reserved and marked failed if push fails (prevents duplicates)');
  assert.strictEqual(deliveries[0].delivered, false);
  assert.strictEqual(deliveries[0].state, 'failed');
  assert.ok(String(deliveries[0].lastError || '').includes('push_failed'));

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_FAIL_1', 50);
  const execAudits = audits.filter((a) => a.action === 'notifications.send.execute');
  assert.ok(execAudits.length >= 1, 'expected notifications.send.execute audit');
  assert.ok(execAudits.some((a) => a.payloadSummary && a.payloadSummary.ok === false), 'expected ok=false in audit');
  assert.ok(execAudits.some((a) => a.payloadSummary && a.payloadSummary.reason === 'send_failed'), 'expected reason=send_failed in audit');
});
