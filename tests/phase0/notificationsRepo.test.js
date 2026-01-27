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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('notificationsRepo: create -> list with filter', async () => {
  await notificationsRepo.createNotification({ status: 'draft', scenarioKey: 'A', stepKey: '3mo' });
  await notificationsRepo.createNotification({ status: 'sent', scenarioKey: 'A', stepKey: '3mo' });

  const drafts = await notificationsRepo.listNotifications({ status: 'draft' });
  assert.strictEqual(drafts.length, 1);
  assert.strictEqual(drafts[0].status, 'draft');
});
