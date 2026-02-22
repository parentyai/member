'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { getNotificationOperationalSummary } = require('../../src/usecases/admin/getNotificationOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase334: notification operational summary includeMeta returns not_available metadata in require mode', async () => {
  const result = await getNotificationOperationalSummary({
    snapshotMode: 'require',
    includeMeta: true
  });

  assert.ok(result && typeof result === 'object');
  assert.ok(Array.isArray(result.items));
  assert.strictEqual(result.items.length, 0);
  assert.strictEqual(result.meta.dataSource, 'not_available');
});
