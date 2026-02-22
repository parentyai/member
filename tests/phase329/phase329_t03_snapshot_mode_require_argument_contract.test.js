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
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing', async () => {
  await usersRepo.createUser('U_phase329', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-01-01T00:00:00Z'
  });

  const summary = await getUserOperationalSummary({ snapshotMode: 'require' });
  assert.deepStrictEqual(summary, []);

  const state = await getUserStateSummary({ lineUserId: 'U_phase329', snapshotMode: 'require' });
  assert.strictEqual(state.lineUserId, 'U_phase329');
  assert.strictEqual(state.notAvailable, true);
  assert.strictEqual(state.notAvailableReason, 'snapshot_required_not_available');
});
