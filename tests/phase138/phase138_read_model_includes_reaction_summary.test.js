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
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
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

test('phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys', async () => {
  const notif = await notificationsRepo.createNotification({
    title: 't',
    body: 'b',
    ctaText: 'open',
    linkRegistryId: 'l1',
    scenarioKey: 's1',
    stepKey: 'st1',
    status: 'sent',
    createdAt: 1
  });
  await deliveriesRepo.createDelivery({ notificationId: notif.id, lineUserId: 'U1', delivered: true, readAt: '2026-02-09T00:00:00Z' });
  await deliveriesRepo.createDelivery({ notificationId: notif.id, lineUserId: 'U2', delivered: true, clickAt: '2026-02-09T00:00:01Z' });

  const items = await getNotificationReadModel({ limit: 10 });
  assert.ok(Array.isArray(items));
  assert.strictEqual(items.length, 1);
  const item = items[0];

  assert.ok(Object.prototype.hasOwnProperty.call(item, 'notificationId'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'deliveredCount'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'readCount'));
  assert.ok(Object.prototype.hasOwnProperty.call(item, 'clickCount'));

  assert.ok(Object.prototype.hasOwnProperty.call(item, 'reactionSummary'));
  assert.deepStrictEqual(Object.keys(item.reactionSummary).sort(), ['clicked', 'ctr', 'sent'].sort());
  assert.strictEqual(item.reactionSummary.sent, 2);
  assert.strictEqual(item.reactionSummary.clicked, 1);
  assert.ok(typeof item.reactionSummary.ctr === 'number');

  assert.ok(Object.prototype.hasOwnProperty.call(item, 'notificationHealth'));
  assert.ok(['OK', 'WARN', 'DANGER'].includes(item.notificationHealth));
});

test('phase138: reactionSummary always exists even when no deliveries', async () => {
  const notif = await notificationsRepo.createNotification({
    title: 't2',
    body: 'b2',
    ctaText: 'open',
    linkRegistryId: 'l1',
    scenarioKey: 's1',
    stepKey: 'st1',
    status: 'sent',
    createdAt: 1
  });

  const items = await getNotificationReadModel({ limit: 10 });
  assert.strictEqual(items.length, 1);
  const item = items[0];
  assert.strictEqual(item.notificationId, notif.id);
  assert.deepStrictEqual(item.reactionSummary, { sent: 0, clicked: 0, ctr: 0 });
  assert.strictEqual(item.notificationHealth, 'OK');
});
