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

const notificationTemplatesRepo = require('../../src/repos/firestore/notificationTemplatesRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
const { createConfirmToken } = require('../../src/domain/confirmToken');
const { planSegmentSend } = require('../../src/usecases/phase67/planSegmentSend');
const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase68: execute is blocked by per-user weekly cap', async () => {
  await systemFlagsRepo.setServicePhase(2);
  await systemFlagsRepo.setNotificationPreset('B');
  await systemFlagsRepo.setNotificationCaps({ perUserWeeklyCap: 1 });

  await notificationTemplatesRepo.createTemplate({
    key: 'ops_alert',
    title: 'Alert',
    body: 'Body',
    status: 'active',
    notificationCategory: 'SEQUENCE_GUIDANCE'
  });

  await deliveriesRepo.createDeliveryWithId('d_prev_u1', {
    notificationId: 'n_prev',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-07T12:00:00.000Z',
    deliveredAt: '2026-02-07T12:00:00.000Z'
  });

  const plan = await planSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops'
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] })
  });

  const now = new Date('2026-02-08T10:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const confirmToken = createConfirmToken({
    planHash: plan.planHash,
    templateKey: plan.templateKey,
    templateVersion: plan.templateVersion,
    segmentKey: null
  }, { now, secret: confirmTokenSecret });

  let sendCount = 0;
  const result = await executeSegmentSend({
    templateKey: 'ops_alert',
    segmentQuery: {},
    requestedBy: 'ops',
    planHash: plan.planHash,
    confirmToken
  }, {
    buildSendSegment: async () => ({ ok: true, items: [{ lineUserId: 'U1' }] }),
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE', enabled: true }),
      normalizePhase48Config: (record) => ({ mode: record.mode, enabled: true })
    },
    now,
    confirmTokenSecret,
    getKillSwitch: async () => false,
    sendFn: async () => { sendCount += 1; }
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'notification_cap_blocked');
  assert.strictEqual(result.capBlockedCount, 1);
  assert.strictEqual(sendCount, 0);
});
