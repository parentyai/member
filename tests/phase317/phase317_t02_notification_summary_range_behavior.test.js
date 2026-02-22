'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { getNotificationOperationalSummary } = require('../../src/usecases/admin/getNotificationOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('phase317: notification summary ignores events older than notification sendAt in bounded path', async () => {
  const sentAt = new Date('2026-02-10T00:00:00.000Z');
  const oldAt = new Date('2026-01-01T00:00:00.000Z');
  const recentAt = new Date('2026-02-12T00:00:00.000Z');
  const notification = await notificationsRepo.createNotification({
    title: 'ops summary bounded',
    scenarioKey: 'A',
    stepKey: 'week',
    sentAt,
    createdAt: sentAt
  });
  const db = require('../../src/infra/firestore').getDb();
  await db.collection('events').doc('old_open').set({
    lineUserId: 'U1',
    type: 'open',
    ref: { notificationId: notification.id },
    createdAt: oldAt
  }, { merge: false });
  await db.collection('events').doc('recent_open').set({
    lineUserId: 'U1',
    type: 'open',
    ref: { notificationId: notification.id },
    createdAt: recentAt
  }, { merge: false });
  await db.collection('events').doc('recent_click').set({
    lineUserId: 'U1',
    type: 'click',
    ref: { notificationId: notification.id },
    createdAt: recentAt
  }, { merge: false });

  const rows = await getNotificationOperationalSummary({ limit: 10, eventsLimit: 100 });
  const target = rows.find((row) => row.notificationId === notification.id);
  assert.ok(target);
  assert.strictEqual(target.openCount, 1);
  assert.strictEqual(target.clickCount, 1);
});
