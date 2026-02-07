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
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase24 t08: summary includes opsState when present', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo', memberNumber: 'M1' });
  await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [{ itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 }]
  });
  const db = require('../../src/infra/firestore').getDb();
  await db.collection('ops_states').doc('U1').set({
    nextAction: 'NO_ACTION',
    failure_class: 'PASS',
    sourceDecisionLogId: 'd1',
    updatedAt: 'NOW'
  }, { merge: true });

  const result = await getUserStateSummary({ lineUserId: 'U1' });
  assert.strictEqual(result.opsState.nextAction, 'NO_ACTION');
  assert.deepStrictEqual(result.opsStateCompleteness, { status: 'OK', missing: [] });
});
