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
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

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

test('phase24 t11: wait rule keys are always present and unset behavior is stable', async () => {
  await notificationsRepo.createNotification({
    title: 't',
    body: 'b',
    ctaText: 'open',
    linkRegistryId: 'l1',
    scenarioKey: 'A',
    stepKey: '3mo',
    notificationCategory: 'SEQUENCE_GUIDANCE',
    status: 'sent',
    createdAt: 1
  });

  const items = await getNotificationReadModel({ limit: 10 });
  assert.ok(Array.isArray(items));
  assert.strictEqual(items.length, 1);
  const item = items[0];

  assert.ok(Object.prototype.hasOwnProperty.call(item, 'waitRuleType'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'waitRuleConfigured'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'nextWaitDays'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'nextWaitDaysSource'));

  assert.strictEqual(typeof item.waitRuleConfigured, 'boolean');
  assert.strictEqual(typeof item.waitRuleType, 'string');
  assert.strictEqual(item.nextWaitDays, null);
  assert.strictEqual(item.nextWaitDaysSource, 'ssot_unset');

  assert.ok(Object.prototype.hasOwnProperty.call(item, 'notificationId'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'deliveredCount'));
});
