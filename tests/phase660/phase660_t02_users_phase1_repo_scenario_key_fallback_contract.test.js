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
const usersPhase1Repo = require('../../src/repos/firestore/usersPhase1Repo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase660: usersPhase1Repo merges scenarioKey canonical and legacy scenario rows', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', createdAt: '2026-02-20T00:00:00.000Z' });
  await usersRepo.createUser('U2', { scenario: 'A', createdAt: '2026-02-21T00:00:00.000Z' });
  await usersRepo.createUser('U3', { scenarioKey: 'B', createdAt: '2026-02-22T00:00:00.000Z' });
  await usersRepo.createUser('U4', {
    scenarioKey: 'A',
    scenario: 'A',
    createdAt: '2026-02-23T00:00:00.000Z'
  });

  const rows = await usersPhase1Repo.listUsersByScenario('A', 10);
  const ids = rows.map((row) => row.id);
  assert.deepStrictEqual(ids, ['U4', 'U2', 'U1']);
});

test('phase660: usersPhase1Repo applies unified limit after merge', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', createdAt: '2026-02-20T00:00:00.000Z' });
  await usersRepo.createUser('U2', { scenario: 'A', createdAt: '2026-02-21T00:00:00.000Z' });
  await usersRepo.createUser('U3', { scenarioKey: 'A', createdAt: '2026-02-22T00:00:00.000Z' });

  const rows = await usersPhase1Repo.listUsersByScenario('A', 2);
  const ids = rows.map((row) => row.id);
  assert.deepStrictEqual(ids, ['U3', 'U2']);
});
