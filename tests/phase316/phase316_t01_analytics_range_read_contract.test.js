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

test('phase316: analytics range queries return only bounded rows', async () => {
  const db = require('../../src/infra/firestore').getDb();
  const now = new Date();
  const old = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const recentA = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const recentB = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  await db.collection('events').doc('old_event').set({ createdAt: old }, { merge: false });
  await db.collection('events').doc('recent_event_a').set({ createdAt: recentA }, { merge: false });
  await db.collection('events').doc('recent_event_b').set({ createdAt: recentB }, { merge: false });

  await db.collection('notification_deliveries').doc('old_delivery').set({ sentAt: old }, { merge: false });
  await db.collection('notification_deliveries').doc('recent_delivery_a').set({ sentAt: recentA }, { merge: false });
  await db.collection('notification_deliveries').doc('recent_delivery_b').set({ sentAt: recentB }, { merge: false });

  const events = await analyticsReadRepo.listEventsByCreatedAtRange({
    fromAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    toAt: now,
    limit: 10
  });
  const deliveries = await analyticsReadRepo.listNotificationDeliveriesBySentAtRange({
    fromAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    toAt: now,
    limit: 10
  });

  assert.deepStrictEqual(events.map((row) => row.id), ['recent_event_b', 'recent_event_a']);
  assert.deepStrictEqual(deliveries.map((row) => row.id), ['recent_delivery_b', 'recent_delivery_a']);
});
