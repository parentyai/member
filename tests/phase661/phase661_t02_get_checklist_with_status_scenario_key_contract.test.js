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
const { getChecklistWithStatus } = require('../../src/usecases/checklists/getChecklistWithStatus');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase661: getChecklistWithStatus returns scenarioKey add-only metadata', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A' });
  await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 }]
  });

  const result = await getChecklistWithStatus({ lineUserId: 'U1', step: '3mo' });
  assert.strictEqual(result.scenarioKey, 'A');
  assert.strictEqual(result.scenario, 'A');
  assert.strictEqual(Array.isArray(result.items), true);
  assert.strictEqual(result.items.length, 1);
});
