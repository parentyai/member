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
const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { getUserStateSummary } = require('../../src/usecases/phase5/getUserStateSummary');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('getUserStateSummary: returns read-only state', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo', memberNumber: 'M1' });
  const checklist = await checklistsRepo.createChecklist({
    scenario: 'A',
    step: '3mo',
    items: [
      { itemId: 'i1', title: 't1', linkRegistryId: 'L1', order: 1 },
      { itemId: 'i2', title: 't2', linkRegistryId: 'L2', order: 2 }
    ]
  });
  await userChecklistsRepo.upsertUserChecklist({
    lineUserId: 'U1',
    checklistId: checklist.id,
    itemId: 'i1',
    completedAt: 'DONE'
  });
  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'open', ref: { notificationId: 'n1' } });
  setServerTimestampForTest('2026-01-02T00:00:00Z');
  await eventsRepo.createEvent({ lineUserId: 'U1', type: 'click', ref: { notificationId: 'n1' } });

  const result = await getUserStateSummary({ lineUserId: 'U1' });
  assert.strictEqual(result.lineUserId, 'U1');
  assert.strictEqual(result.hasMemberNumber, true);
  assert.strictEqual(result.checklistCompleted, 1);
  assert.strictEqual(result.checklistTotal, 2);
  assert.ok(result.lastActionAt && result.lastActionAt.startsWith('2026-01-02'));
});
