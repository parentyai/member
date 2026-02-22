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
const { getStaleMemberNumberUsers } = require('../../src/usecases/phase5/getStaleMemberNumberUsers');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase325: stale member summary respects limit option', async () => {
  await usersRepo.createUser('U1', { createdAt: '2025-12-01T00:00:00Z', scenarioKey: 'A', stepKey: '3mo' });
  await usersRepo.createUser('U2', { createdAt: '2025-11-01T00:00:00Z', scenarioKey: 'A', stepKey: '3mo' });

  const result = await getStaleMemberNumberUsers({
    limit: 1,
    nowMs: new Date('2026-01-20T00:00:00Z').getTime()
  });

  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.items.length, 1);
});
