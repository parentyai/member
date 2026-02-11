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
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
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
  if (ORIGINAL_SECRET === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
  else process.env.OPS_CONFIRM_TOKEN_SECRET = ORIGINAL_SECRET;
});

test('phase161: execute is blocked when per-user weekly cap is exceeded', async () => {
  await systemFlagsRepo.setServicePhase(2);
  await systemFlagsRepo.setNotificationPreset('B');
  await systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 1 });

  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: 'week' });

  const created = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: 'week',
    notificationCategory: 'SEQUENCE_GUIDANCE',
    target: { limit: 10 },
    createdBy: 'admin_composer'
  });
  await approveNotification({ notificationId: created.id, actor: 'admin_composer' });

  await deliveriesRepo.createDeliveryWithId('d_prev_u1', {
    notificationId: 'n_prev',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-09T00:00:00.000Z',
    deliveredAt: '2026-02-09T00:00:00.000Z'
  });

  const plan = await planNotificationSend({
    notificationId: created.id,
    actor: 'admin_composer',
    traceId: 'TRACE_CAP_161',
    requestId: 'REQ_CAP_161_1'
  }, { now: new Date('2026-02-10T00:00:00.000Z') });
  assert.strictEqual(plan.ok, true);

  let pushCount = 0;
  const exec = await executeNotificationSend({
    notificationId: created.id,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken,
    actor: 'admin_composer',
    traceId: 'TRACE_CAP_161',
    requestId: 'REQ_CAP_161_2'
  }, {
    now: new Date('2026-02-10T00:00:30.000Z'),
    getKillSwitch: async () => false,
    pushFn: async () => { pushCount += 1; }
  });

  assert.strictEqual(exec.ok, false);
  assert.strictEqual(exec.reason, 'notification_cap_blocked');
  assert.strictEqual(exec.capBlockedCount, 1);
  assert.strictEqual(pushCount, 0);

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_CAP_161', 50);
  const executeAudit = audits.find((entry) => entry.action === 'notifications.send.execute');
  assert.ok(executeAudit);
  assert.strictEqual(executeAudit.payloadSummary.reason, 'notification_cap_blocked');
});
