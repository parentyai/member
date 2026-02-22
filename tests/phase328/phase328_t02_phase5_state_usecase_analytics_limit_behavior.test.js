'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  clearServerTimestampForTest,
  setServerTimestampForTest
} = require('../../src/infra/firestore');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase328: user state summary accepts analyticsLimit knob', async () => {
  await usersRepo.createUser('U_phase328', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-01-01T00:00:00Z'
  });

  const result = await getUserStateSummary({
    lineUserId: 'U_phase328',
    analyticsLimit: 1,
    useSnapshot: false
  });

  assert.strictEqual(result.lineUserId, 'U_phase328');
});
