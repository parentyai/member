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

const userChecklistsRepo = require('../../src/repos/firestore/userChecklistsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { toggleChecklistItem } = require('../../src/usecases/checklists/toggleChecklistItem');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('toggleChecklistItem: upserts and sets completedAt', async () => {
  const result = await toggleChecklistItem({
    lineUserId: 'U1',
    checklistId: 'C1',
    itemId: 'I1',
    complete: true
  });
  assert.strictEqual(result.id, 'U1__C1__I1');
  const stored = await userChecklistsRepo.getUserChecklist('U1', 'C1', 'I1');
  assert.strictEqual(stored.completedAt, 'SERVER_TIMESTAMP');
});

test('toggleChecklistItem: event failure does not block', async () => {
  const originalCreate = eventsRepo.createEvent;
  eventsRepo.createEvent = async () => {
    throw new Error('event failed');
  };

  const result = await toggleChecklistItem({
    lineUserId: 'U1',
    checklistId: 'C1',
    itemId: 'I1',
    complete: true
  });
  assert.strictEqual(result.id, 'U1__C1__I1');
  const stored = await userChecklistsRepo.getUserChecklist('U1', 'C1', 'I1');
  assert.strictEqual(stored.completedAt, 'SERVER_TIMESTAMP');

  eventsRepo.createEvent = originalCreate;
});
