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

const repo = require('../../src/repos/firestore/opsStatesRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase24 t07: upsert stores updatedAt serverTimestamp', async () => {
  await repo.upsertOpsState('U1', { nextAction: 'NO_ACTION' });
  const doc = await repo.getOpsState('U1');
  assert.strictEqual(doc.updatedAt, 'SERVER_TIMESTAMP');
});
