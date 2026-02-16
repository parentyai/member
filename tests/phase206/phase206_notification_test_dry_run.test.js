'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest,
  getDb
} = require('../../src/infra/firestore');

const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
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

test('phase206: dry-run stores run record and passes', async () => {
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
    mode: 'dry_run',
    notificationId: created.id
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.summary.total, 1);
  assert.strictEqual(result.summary.passed, 1);
  assert.strictEqual(result.summary.failed, 0);

  const db = getDb();
  const runs = db._state.collections.notification_test_runs;
  const items = db._state.collections.notification_test_run_items;
  assert.ok(runs && runs.docs[result.runId]);
  assert.ok(items && Object.keys(items.docs).length === 1);
});
