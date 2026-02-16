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

const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { createNotification } = require('../../src/usecases/notifications/createNotification');
const { runNotificationTest } = require('../../src/usecases/notifications/runNotificationTest');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase206: self-send uses sendNotification without status update', async () => {
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

  const result = await runNotificationTest({
    mode: 'self_send',
    notificationId: created.id,
    lineUserId: 'U1',
    pushFn: async () => ({ status: 200 })
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.summary.total, 1);
  assert.strictEqual(result.summary.passed, 1);

  const stored = await notificationsRepo.getNotification(created.id);
  assert.strictEqual(stored.status, 'draft');
});
