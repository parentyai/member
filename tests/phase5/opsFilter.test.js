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
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { getUsersSummaryFiltered } = require('../../src/usecases/phase5/getUsersSummaryFiltered');
const { getNotificationsSummaryFiltered } = require('../../src/usecases/phase5/getNotificationsSummaryFiltered');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase5 ops filters: date range', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo' });

  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'open', ref: { notificationId: 'n1' } });
  setServerTimestampForTest('2026-01-10T00:00:00Z');
  await eventsRepo.createEvent({ lineUserId: 'U2', type: 'open', ref: { notificationId: 'n2' } });

  const notif1 = await notificationsRepo.createNotification({ title: 'N1', sentAt: '2026-01-01T00:00:00Z' });
  const notif2 = await notificationsRepo.createNotification({ title: 'N2', sentAt: '2026-01-10T00:00:00Z' });
  setServerTimestampForTest('2026-01-01T00:00:00Z');
  await eventsRepo.createEvent({ lineUserId: 'U3', type: 'open', ref: { notificationId: notif1.id } });
  setServerTimestampForTest('2026-01-10T00:00:00Z');
  await eventsRepo.createEvent({ lineUserId: 'U3', type: 'click', ref: { notificationId: notif2.id } });

  const fromMs = new Date('2026-01-05T00:00:00Z').getTime();
  const toMs = new Date('2026-01-10T23:59:59Z').getTime();

  const users = await getUsersSummaryFiltered({ fromMs, toMs });
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].lineUserId, 'U2');

  const notifications = await getNotificationsSummaryFiltered({ fromMs, toMs });
  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].notificationId, notif2.id);
});

test('phase323: notifications summary filter forwards limit/eventsLimit options', async () => {
  const notif1 = await notificationsRepo.createNotification({
    title: 'N1',
    sentAt: '2026-01-01T00:00:00Z'
  });
  setServerTimestampForTest('2026-01-02T00:00:00Z');
  const notif2 = await notificationsRepo.createNotification({
    title: 'N2',
    sentAt: '2026-01-02T00:00:00Z'
  });

  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'open', ref: { notificationId: notif1.id } });
  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'open', ref: { notificationId: notif2.id } });

  const notifications = await getNotificationsSummaryFiltered({ limit: 1, eventsLimit: 1 });
  assert.strictEqual(notifications.length, 1);
});

test('phase324: users summary filter forwards limit/analyticsLimit options', async () => {
  await usersRepo.createUser('U1', {
    scenarioKey: 'A',
    stepKey: '3mo',
    createdAt: '2026-01-01T00:00:00Z'
  });
  await usersRepo.createUser('U2', {
    scenarioKey: 'A',
    stepKey: '3mo',
    createdAt: '2026-01-02T00:00:00Z'
  });

  const users = await getUsersSummaryFiltered({ limit: 1, analyticsLimit: 1 });
  assert.strictEqual(users.length, 1);
});
