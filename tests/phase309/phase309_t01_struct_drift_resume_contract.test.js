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
const { runStructDriftBackfill } = require('../../src/usecases/structure/runStructDriftBackfill');

test('phase309: struct drift backfill supports resumeAfterUserId cursor', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('users').doc('U1').set({ scenario: 'A' }, { merge: false });
  await db.collection('users').doc('U2').set({ scenario: 'C' }, { merge: false });

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const first = await runStructDriftBackfill({ db, dryRun: true, scanLimit: 1 });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.summary.scannedUsers, 1);
  assert.strictEqual(first.summary.hasMore, true);
  assert.ok(first.summary.nextResumeAfterUserId);

  const applyFirst = await runStructDriftBackfill({
    db,
    apply: true,
    scanLimit: 1
  });
  assert.strictEqual(applyFirst.summary.mode, 'apply');
  assert.strictEqual(applyFirst.summary.scenarioBackfilled, 1);

  const resumeToken = applyFirst.summary.nextResumeAfterUserId;
  const applySecond = await runStructDriftBackfill({
    db,
    apply: true,
    scanLimit: 10,
    resumeAfterUserId: resumeToken
  });
  assert.strictEqual(applySecond.summary.scenarioBackfilled, 1);
  assert.strictEqual(applySecond.summary.hasMore, false);

  const u1 = await db.collection('users').doc('U1').get();
  const u2 = await db.collection('users').doc('U2').get();
  assert.strictEqual(u1.data().scenarioKey, 'A');
  assert.strictEqual(u2.data().scenarioKey, 'C');
});
