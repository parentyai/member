'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

test('phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing', async (t) => {
  const prevSnapshotMode = process.env.OPS_SNAPSHOT_MODE;
  process.env.OPS_SNAPSHOT_MODE = 'require';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('users').doc('U_phase312').set({
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-02-01T00:00:00.000Z'
  }, { merge: false });

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevSnapshotMode === undefined) delete process.env.OPS_SNAPSHOT_MODE;
    else process.env.OPS_SNAPSHOT_MODE = prevSnapshotMode;
  });

  const summary = await getUserOperationalSummary();
  assert.deepStrictEqual(summary, []);

  const state = await getUserStateSummary({ lineUserId: 'U_phase312' });
  assert.strictEqual(state.lineUserId, 'U_phase312');
  assert.strictEqual(state.notAvailable, true);
  assert.strictEqual(state.notAvailableReason, 'snapshot_required_not_available');
});
