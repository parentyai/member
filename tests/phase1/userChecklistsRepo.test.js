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

const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('userChecklistsRepo: upsert -> get -> list', async () => {
  const key = { lineUserId: 'U1', checklistId: 'C1', itemId: 'I1' };
  const created = await userChecklistsRepo.upsertUserChecklist({
    ...key,
    completedAt: null
  });
  assert.strictEqual(created.id, 'U1__C1__I1');

  const fetched = await userChecklistsRepo.getUserChecklist('U1', 'C1', 'I1');
  assert.strictEqual(fetched.completedAt, null);
  assert.strictEqual(fetched.updatedAt, 'SERVER_TIMESTAMP');

  await userChecklistsRepo.upsertUserChecklist({
    ...key,
    completedAt: 'DONE'
  });
  const updated = await userChecklistsRepo.getUserChecklist('U1', 'C1', 'I1');
  assert.strictEqual(updated.completedAt, 'DONE');

  const list = await userChecklistsRepo.listUserChecklists({ lineUserId: 'U1', checklistId: 'C1' });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, 'U1__C1__I1');
});
