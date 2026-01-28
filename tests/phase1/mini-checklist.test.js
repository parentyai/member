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
const { getChecklistWithStatus } = require('../../src/usecases/checklists/getChecklistWithStatus');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('getChecklistWithStatus: includes completion state', async () => {
  await usersRepo.createUser('U1', { scenario: 'A' });
  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [
      { itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 },
      { itemId: 'i2', title: 't2', linkRegistryId: 'L2', order: 2 }
    ]
  });
  await userChecklistsRepo.upsertUserChecklist({
    lineUserId: 'U1',
    checklistId: checklist.id,
    itemId: 'i1',
    completedAt: 'DONE'
  });

  const result = await getChecklistWithStatus({ lineUserId: 'U1', step: '3mo' });
  const item1 = result.items.find((item) => item.itemId === 'i1');
  const item2 = result.items.find((item) => item.itemId === 'i2');
  assert.strictEqual(item1.completedAt, 'DONE');
  assert.strictEqual(item2.completedAt, null);
});
