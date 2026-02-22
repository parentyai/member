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
const { getUserOperationalSummary } = require('../../src/usecases/admin/getUserOperationalSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-01T00:00:00.000Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase319: range-first path ignores out-of-window events when bounded set is non-empty', async () => {
  const db = require('../../src/infra/firestore').getDb();

  await usersRepo.createUser('U1', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-02-01T00:00:00.000Z'
  });
  await usersRepo.createUser('U2', {
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: '2026-02-01T00:00:00.000Z'
  });

  await db.collection('events').doc('old_u1').set({
    lineUserId: 'U1',
    type: 'open',
    createdAt: new Date('2025-12-01T00:00:00.000Z')
  }, { merge: false });
  await db.collection('events').doc('recent_u2').set({
    lineUserId: 'U2',
    type: 'open',
    createdAt: new Date('2026-02-02T00:00:00.000Z')
  }, { merge: false });

  const summary = await getUserOperationalSummary({ analyticsLimit: 2000 });
  const u1 = summary.find((row) => row.lineUserId === 'U1');
  const u2 = summary.find((row) => row.lineUserId === 'U2');

  assert.ok(u1);
  assert.ok(u2);
  assert.strictEqual(u1.lastActionAt, null);
  assert.ok(typeof u2.lastActionAt === 'string' && u2.lastActionAt.startsWith('2026-02-02'));
});
