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
const { getUsersSummaryFiltered } = require('../../src/usecases/phase5/getUsersSummaryFiltered');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('ops flags: memberNumber stale yes/no', async () => {
  await usersRepo.createUser('U1', { memberNumber: null, createdAt: '2025-12-01T00:00:00Z' });
  await usersRepo.createUser('U2', { memberNumber: 'M2', createdAt: '2025-12-01T00:00:00Z' });
  await usersRepo.createUser('U3', { memberNumber: null, createdAt: '2026-01-10T00:00:00Z' });

  const items = await getUsersSummaryFiltered({ nowMs: new Date('2026-01-20T00:00:00Z').getTime() });
  const map = new Map(items.map((item) => [item.lineUserId, item]));

  assert.strictEqual(map.get('U1').opsFlags.memberNumberStale, true);
  assert.strictEqual(map.get('U2').opsFlags.memberNumberStale, false);
  assert.strictEqual(map.get('U3').opsFlags.memberNumberStale, false);
});
