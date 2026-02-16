'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
const { planNotificationSend } = require('../../src/usecases/adminOs/planNotificationSend');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase205: plan returns capBlockedCount based on caps', async () => {
  await systemFlagsRepo.setNotificationCaps({
    perUserWeeklyCap: 1,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  const notif = await notificationsRepo.createNotification({
    title: 't',
    body: 'b',
    ctaText: 'open',
    linkRegistryId: 'l1',
    scenarioKey: 'A',
    stepKey: '3mo',
    status: 'active',
    notificationCategory: 'IMMEDIATE_ACTION',
    target: { limit: 2 },
    createdAt: 1
  });

  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo', createdAt: 1 });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo', createdAt: 2 });
  await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true,
    deliveredAt: '2026-02-15T00:00:00Z'
  });
  await deliveriesRepo.createDelivery({
    notificationId: 'n2',
    lineUserId: 'U2',
    delivered: true,
    deliveredAt: '2026-02-15T00:00:00Z'
  });

  const now = new Date('2026-02-16T00:00:00Z');
  const result = await planNotificationSend({ notificationId: notif.id, actor: 'test' }, { now });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.capBlockedCount, 2);
  assert.ok(result.capBlockedSummary);
  assert.strictEqual(result.capBlockedSummary['PER_USER_WEEKLY:per_user_weekly_cap_exceeded'], 2);
});

test('phase205: composer shows plan cap blocked count label', () => {
  const composer = readFileSync('apps/admin/composer.html', 'utf8');
  assert.ok(composer.includes('id="planCapBlockedCount"'));
  assert.ok(composer.includes('抑制数（plan）'));
});
