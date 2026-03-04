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

test('phase161: composer flow draft -> approve -> plan -> execute (no real send)', async () => {
  const prevMulti = process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
  const prevButtons = process.env.ENABLE_LINE_CTA_BUTTONS_V1;
  process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = '1';
  process.env.ENABLE_LINE_CTA_BUTTONS_V1 = '1';
  try {
    const primary = await linkRegistryRepo.createLink({ title: 'p', url: 'https://example.com/p' });
    const secondary1 = await linkRegistryRepo.createLink({ title: 's1', url: 'https://example.com/s1' });
    const secondary2 = await linkRegistryRepo.createLink({ title: 's2', url: 'https://example.com/s2' });

    await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: 'week' });
    await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: 'week' });

    const created = await createNotification({
      title: 'Title',
      body: 'Body',
      ctaText: 'Go',
      linkRegistryId: primary.id,
      secondaryCtas: [
        { ctaText: 'More', linkRegistryId: secondary1.id },
        { ctaText: 'FAQ', linkRegistryId: secondary2.id }
      ],
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
    assert.strictEqual(plan.ctaCount, 3);
    assert.strictEqual(plan.ctaLinkRegistryIds.length, 3);
    const afterPlan = await notificationsRepo.getNotification(created.id);
    assert.strictEqual(afterPlan.status, 'planned');

    const sentTo = [];
    const sentMessages = [];
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
      pushFn: async (lineUserId, message) => {
        sentTo.push(lineUserId);
        sentMessages.push(message);
        return { status: 200 };
      }
    });

    assert.strictEqual(exec.ok, true);
    assert.strictEqual(exec.deliveredCount, 2);
    assert.strictEqual(sentTo.length, 2);
    assert.strictEqual(exec.ctaCount, 3);
    assert.strictEqual(exec.lineMessageType, 'template_buttons');
    assert.strictEqual(sentMessages[0].type, 'template');

    const updated = await notificationsRepo.getNotification(created.id);
    assert.strictEqual(updated.status, 'sent');

    const listDeliveries = await deliveriesRepo.listDeliveriesByNotificationId(created.id);
    assert.strictEqual(listDeliveries.length, 2);

    const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_1', 50);
    const actions = audits.map((a) => a.action).filter(Boolean);
    assert.ok(actions.includes('notifications.send.plan'));
    assert.ok(actions.includes('notifications.send.execute'));

    const planAudit = audits.find((entry) => entry.action === 'notifications.send.plan');
    const executeAudit = audits.find((entry) => entry.action === 'notifications.send.execute' && entry.payloadSummary && entry.payloadSummary.ok === true);
    assert.ok(planAudit && planAudit.payloadSummary);
    assert.ok(executeAudit && executeAudit.payloadSummary);
    assert.strictEqual(planAudit.payloadSummary.ctaCount, 3);
    assert.strictEqual(Array.isArray(planAudit.payloadSummary.ctaLinkRegistryIds), true);
    assert.strictEqual(Array.isArray(planAudit.payloadSummary.ctaLabelHashes), true);
    assert.strictEqual(Array.isArray(planAudit.payloadSummary.ctaLabelLengths), true);
    assert.strictEqual(executeAudit.payloadSummary.ctaCount, 3);
    assert.strictEqual(Array.isArray(executeAudit.payloadSummary.ctaLinkRegistryIds), true);
    assert.strictEqual(executeAudit.payloadSummary.lineMessageType, 'template_buttons');
  } finally {
    if (prevMulti === undefined) delete process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1;
    else process.env.ENABLE_NOTIFICATION_CTA_MULTI_V1 = prevMulti;
    if (prevButtons === undefined) delete process.env.ENABLE_LINE_CTA_BUTTONS_V1;
    else process.env.ENABLE_LINE_CTA_BUTTONS_V1 = prevButtons;
  }
});
