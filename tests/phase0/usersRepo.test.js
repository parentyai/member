'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const usersRepo = require('../../src/repos/firestore/usersRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('usersRepo: create -> get -> update', async () => {
  await usersRepo.createUser('U123', { scenarioKey: 'A', stepKey: '3mo' });
  const created = await usersRepo.getUser('U123');
  assert.strictEqual(created.id, 'U123');
  assert.strictEqual(created.scenarioKey, 'A');
  assert.ok(created.createdAt);

  await usersRepo.updateUser('U123', { stepKey: '1mo' });
  const updated = await usersRepo.getUser('U123');
  assert.strictEqual(updated.stepKey, '1mo');
});
