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

test('phase337: users summary includeMeta returns items+meta in require mode', async () => {
  const result = await getUsersSummaryFiltered({
    snapshotMode: 'require',
    includeMeta: true
  });

  assert.ok(result && typeof result === 'object');
  assert.deepStrictEqual(result.items, []);
  assert.strictEqual(result.meta.dataSource, 'not_available');
  assert.strictEqual(result.meta.asOf, null);
});

test('phase337: notifications summary includeMeta returns items+meta in require mode', async () => {
  const result = await getNotificationsSummaryFiltered({
    snapshotMode: 'require',
    includeMeta: true
  });

  assert.ok(result && typeof result === 'object');
  assert.deepStrictEqual(result.items, []);
  assert.strictEqual(result.meta.dataSource, 'not_available');
  assert.strictEqual(result.meta.asOf, null);
});
