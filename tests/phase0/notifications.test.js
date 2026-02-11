'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { listNotifications } = require('../../src/usecases/notifications/listNotifications');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');

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

test('createNotification: stores draft notification', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  assert.ok(result.id);
  const stored = await notificationsRepo.getNotification(result.id);
  assert.ok(stored);
  assert.strictEqual(stored.status, 'draft');
  assert.strictEqual(stored.scenarioKey, 'A');
  assert.strictEqual(stored.stepKey, '3mo');
});

test('createNotification: stores normalized notificationCategory', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const result = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    notificationCategory: 'sequence_guidance',
    target: { all: true }
  });
  const stored = await notificationsRepo.getNotification(result.id);
  assert.strictEqual(stored.notificationCategory, 'SEQUENCE_GUIDANCE');
});

test('sendNotification: creates deliveries for matching users', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const created = await createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });

  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });
  await usersRepo.createUser('U2', { scenarioKey: 'A', stepKey: '3mo' });

  const sentTo = [];
  const result = await sendNotification({
    notificationId: created.id,
    sentAt: 'NOW',
    killSwitch: false,
    pushFn: async (lineUserId) => {
      sentTo.push(lineUserId);
      return { status: 200 };
    }
  });

  assert.strictEqual(result.deliveredCount, 2);
  assert.strictEqual(sentTo.length, 2);

  const deliveries = db._state.collections.notification_deliveries;
  assert.strictEqual(Object.keys(deliveries.docs).length, 2);

  const updated = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(updated.status, 'sent');
  assert.strictEqual(updated.sentAt, 'NOW');
});

test('listNotifications: filters by scenarioKey', async () => {
  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  await createNotification({
    title: 'A',
    body: 'Body A',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true }
  });
  await createNotification({
    title: 'C',
    body: 'Body C',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'C',
    stepKey: '3mo',
    target: { all: true }
  });

  const results = await listNotifications({ scenarioKey: 'A' });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].scenarioKey, 'A');
});
