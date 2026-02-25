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
const { getChecklistForUser } = require('../../src/usecases/checklists/getChecklistForUser');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase661: getChecklistForUser resolves scenarioKey-first and keeps legacy scenario alias', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A' });
  await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 }]
  });

  const result = await getChecklistForUser({ lineUserId: 'U1', step: '3mo' });
  assert.strictEqual(result.scenarioKey, 'A');
  assert.strictEqual(result.scenario, 'A');
  assert.strictEqual(result.checklists.length, 1);
});

test('phase661: getChecklistForUser missing-step response keeps scenarioKey metadata', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A' });
  const result = await getChecklistForUser({ lineUserId: 'U1' });
  assert.strictEqual(result.scenarioKey, 'A');
  assert.strictEqual(result.scenario, 'A');
  assert.strictEqual(result.step, null);
  assert.deepStrictEqual(result.checklists, []);
});
