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

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

function buildTemplateKey(notificationId) {
  return `notification_send:${notificationId}`;
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase190: cap count labels derived from execute audit', async () => {
  const withAudit = await notificationsRepo.createNotification({
    title: 'With Audit',
    scenarioKey: 'A',
    stepKey: '3mo'
  });
  const withoutAudit = await notificationsRepo.createNotification({
    title: 'Without Audit',
    scenarioKey: 'A',
    stepKey: '1mo'
  });

  await auditLogsRepo.appendAuditLog({
    actor: 'admin',
    action: 'notifications.send.execute',
    entityType: 'notification',
    entityId: withAudit.id,
    templateKey: buildTemplateKey(withAudit.id),
    payloadSummary: {
      ok: false,
      reason: 'notification_cap_blocked',
      capCountMode: 'delivered_at_only',
      capCountSource: 'snapshot',
      capCountStrategy: 'per_user_weekly'
    }
  });

  const items = await getNotificationReadModel({ limit: 10 });
  const byId = new Map(items.map((item) => [item.notificationId, item]));

  const audited = byId.get(withAudit.id);
  assert.ok(audited, 'audit notification missing');
  assert.strictEqual(audited.lastExecuteReason, 'notification_cap_blocked');
  assert.strictEqual(audited.capCountMode, 'delivered_at_only');
  assert.strictEqual(audited.capCountSource, 'snapshot');
  assert.strictEqual(audited.capCountStrategy, 'per_user_weekly');

  const missing = byId.get(withoutAudit.id);
  assert.ok(missing, 'missing notification missing');
  assert.strictEqual(missing.lastExecuteReason, 'execute_missing');
  assert.strictEqual(missing.capCountMode, null);
  assert.strictEqual(missing.capCountSource, null);
  assert.strictEqual(missing.capCountStrategy, null);
});
