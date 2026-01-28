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

const checklistsRepo = require('../../src/repos/firestore/checklistsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('checklistsRepo: create -> get -> list', async () => {
  const payload = {
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 }]
  };
  const created = await checklistsRepo.createChecklist(payload);
  assert.ok(created.id);

  const fetched = await checklistsRepo.getChecklist(created.id);
  assert.strictEqual(fetched.scenario, 'A');
  assert.strictEqual(fetched.step, '3mo');
  assert.strictEqual(fetched.items[0].linkRegistryId, 'L1');
  assert.strictEqual(fetched.createdAt, 'SERVER_TIMESTAMP');

  const list = await checklistsRepo.listChecklists({ scenario: 'A', step: '3mo', limit: 10 });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, created.id);
});
