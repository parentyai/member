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
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-01T00:00:00.000Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty', async () => {
  const db = require('../../src/infra/firestore').getDb();

  await usersRepo.createUser('U1', {
    scenarioKey: 'A',
    stepKey: 'week',
    memberNumber: 'M-001',
    createdAt: '2026-02-01T00:00:00.000Z'
  });

  await db.collection('events').doc('old_event_u1').set({
    lineUserId: 'U1',
    type: 'open',
    createdAt: new Date('2025-12-01T00:00:00.000Z')
  }, { merge: false });
  await db.collection('events').doc('recent_event_u1').set({
    lineUserId: 'U1',
    type: 'click',
    createdAt: new Date('2026-02-03T00:00:00.000Z')
  }, { merge: false });

  const state = await getUserStateSummary({ lineUserId: 'U1', analyticsLimit: 2000 });
  assert.ok(state);
  assert.ok(typeof state.lastActionAt === 'string');
  assert.ok(state.lastActionAt.startsWith('2026-02-03'));
});
