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
const checklistsRepo = require('../../src/repos/firestore/checklistsRepo');
const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const { getUsersSummaryFiltered } = require('../../src/usecases/phase5/getUsersSummaryFiltered');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('ops attention flag: memberNumber missing, checklist incomplete, stale', async () => {
  await usersRepo.createUser('U1', { memberNumber: null, createdAt: '2025-12-01T00:00:00Z' });
  await usersRepo.createUser('U2', { memberNumber: 'M2', createdAt: '2026-01-10T00:00:00Z' });
  await usersRepo.createUser('U3', { memberNumber: 'M3', scenarioKey: 'A', stepKey: '3mo', createdAt: '2026-01-01T00:00:00Z' });

  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [
      { itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 },
      { itemId: 'i2', title: 't2', linkRegistryId: 'L2', order: 2 }
    ]
  });

  await userChecklistsRepo.upsertUserChecklist({
    lineUserId: 'U3',
    checklistId: checklist.id,
    itemId: 'i1',
    completedAt: 'DONE'
  });

  const items = await getUsersSummaryFiltered({ nowMs: new Date('2026-01-20T00:00:00Z').getTime() });
  const map = new Map(items.map((item) => [item.lineUserId, item]));

  const u1 = map.get('U1');
  const u2 = map.get('U2');
  const u3 = map.get('U3');

  assert.strictEqual(u1.stale, true);
  assert.strictEqual(u1.needsAttention, true);

  assert.strictEqual(u2.stale, false);
  assert.strictEqual(u2.needsAttention, false);

  assert.strictEqual(u3.stale, false);
  assert.strictEqual(u3.needsAttention, true);
});
