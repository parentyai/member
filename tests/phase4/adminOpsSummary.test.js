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
const checklistsRepo = require('../../src/repos/firestore/checklistsRepo');
const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');
const { getNotificationOperationalSummary } = require('../../src/usecases/admin/getNotificationOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('admin summaries: users and notifications', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo', memberNumber: 'M1' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo' });

  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [
      { itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 },
      { itemId: 'i2', title: 't2', linkRegistryId: 'L2', order: 2 }
    ]
  });
  await userChecklistsRepo.upsertUserChecklist({
    lineUserId: 'U1',
    checklistId: checklist.id,
    itemId: 'i1',
    completedAt: 'DONE'
  });

  const notification = await notificationsRepo.createNotification({
    title: 'Title',
    scenarioKey: 'A',
    stepKey: '3mo',
    sentAt: '2026-01-01T00:00:00Z'
  });

  await eventsRepo.createEvent({
    lineUserId: 'U1',
    type: 'open',
    ref: { notificationId: notification.id }
  });
  setServerTimestampForTest('2026-01-02T00:00:00Z');
  await eventsRepo.createEvent({
    lineUserId: 'U1',
    type: 'click',
    ref: { notificationId: notification.id }
  });

  const usersSummary = await getUserOperationalSummary();
  const user1 = usersSummary.find((item) => item.lineUserId === 'U1');
  const user2 = usersSummary.find((item) => item.lineUserId === 'U2');
  assert.strictEqual(user1.hasMemberNumber, true);
  assert.strictEqual(user1.checklistCompleted, 1);
  assert.strictEqual(user1.checklistTotal, 2);
  assert.ok(user1.lastActionAt && user1.lastActionAt.startsWith('2026-01-02'));
  assert.strictEqual(user2.hasMemberNumber, false);

  const notificationsSummary = await getNotificationOperationalSummary();
  assert.strictEqual(notificationsSummary.length, 1);
  assert.strictEqual(notificationsSummary[0].openCount, 1);
  assert.strictEqual(notificationsSummary[0].clickCount, 1);
  assert.ok(notificationsSummary[0].lastReactionAt && notificationsSummary[0].lastReactionAt.startsWith('2026-01-02'));
});
