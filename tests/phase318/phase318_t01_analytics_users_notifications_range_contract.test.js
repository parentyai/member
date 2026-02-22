'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const analyticsReadRepo = require('../../src/repos/firestore/analyticsReadRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('phase318: analytics users/notifications range queries return only bounded rows', async () => {
  const db = require('../../src/infra/firestore').getDb();
  const now = new Date();
  const old = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const recentA = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const recentB = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  await db.collection('users').doc('old_user').set({ createdAt: old }, { merge: false });
  await db.collection('users').doc('recent_user_a').set({ createdAt: recentA }, { merge: false });
  await db.collection('users').doc('recent_user_b').set({ createdAt: recentB }, { merge: false });

  await db.collection('notifications').doc('old_notification').set({ createdAt: old }, { merge: false });
  await db.collection('notifications').doc('recent_notification_a').set({ createdAt: recentA }, { merge: false });
  await db.collection('notifications').doc('recent_notification_b').set({ createdAt: recentB }, { merge: false });

  const users = await analyticsReadRepo.listUsersByCreatedAtRange({
    fromAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    toAt: now,
    limit: 10
  });
  const notifications = await analyticsReadRepo.listNotificationsByCreatedAtRange({
    fromAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    toAt: now,
    limit: 10
  });

  assert.deepStrictEqual(users.map((row) => row.id), ['recent_user_b', 'recent_user_a']);
  assert.deepStrictEqual(notifications.map((row) => row.id), ['recent_notification_b', 'recent_notification_a']);
});
