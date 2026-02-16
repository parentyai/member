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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase189: targetCountSource derives from plan audit', async () => {
  const planned = await notificationsRepo.createNotification({
    title: 'Planned',
    scenarioKey: 'A',
    stepKey: '3mo'
  });
  const missing = await notificationsRepo.createNotification({
    title: 'Missing',
    scenarioKey: 'A',
    stepKey: '1mo'
  });

  await auditLogsRepo.appendAuditLog({
    actor: 'admin',
    action: 'notifications.send.plan',
    entityType: 'notification',
    entityId: planned.id,
    templateKey: `notification_send:${planned.id}`,
    payloadSummary: {
      notificationId: planned.id,
      count: 12
    },
    snapshot: {
      notificationId: planned.id,
      count: 12
    }
  });

  const items = await getNotificationReadModel({ limit: 10 });
  const byId = new Map(items.map((item) => [item.notificationId, item]));

  const plannedItem = byId.get(planned.id);
  assert.ok(plannedItem, 'planned notification missing');
  assert.strictEqual(plannedItem.targetCount, 12);
  assert.strictEqual(plannedItem.targetCountSource, 'plan_audit');

  const missingItem = byId.get(missing.id);
  assert.ok(missingItem, 'missing notification missing');
  assert.strictEqual(missingItem.targetCount, null);
  assert.strictEqual(missingItem.targetCountSource, 'plan_missing');
});
