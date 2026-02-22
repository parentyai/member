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
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase334: user operational summary includeMeta returns not_available metadata in require mode', async () => {
  await usersRepo.createUser('U_phase334', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-01-01T00:00:00Z'
  });

  const result = await getUserOperationalSummary({
    snapshotMode: 'require',
    includeMeta: true
  });

  assert.ok(result && typeof result === 'object');
  assert.ok(Array.isArray(result.items));
  assert.strictEqual(result.items.length, 0);
  assert.strictEqual(result.meta.dataSource, 'not_available');
});
