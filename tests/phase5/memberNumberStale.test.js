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
const { getStaleMemberNumberUsers } = require('../../src/usecases/phase5/getStaleMemberNumberUsers');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('memberNumber stale: 14 days threshold', async () => {
  await usersRepo.createUser('U1', { memberNumber: null, createdAt: '2026-01-01T00:00:00Z' });
  await usersRepo.createUser('U2', { memberNumber: '', createdAt: '2026-01-10T00:00:00Z' });
  await usersRepo.createUser('U3', { memberNumber: 'M1', createdAt: '2026-01-01T00:00:00Z' });

  const nowMs = new Date('2026-01-20T00:00:00Z').getTime();
  const result = await getStaleMemberNumberUsers({ nowMs });
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.items[0].lineUserId, 'U1');
  assert.ok(result.items[0].daysSinceCreated >= 14);
});
