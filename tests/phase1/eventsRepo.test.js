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

const eventsRepo = require('../../src/repos/firestore/eventsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('eventsRepo: create event', async () => {
  const created = await eventsRepo.createEvent({
    lineUserId: 'U1',
    type: 'open',
    ref: { notificationId: 'N1' }
  });
  assert.ok(created.id);
});

test('eventsRepo: missing required fields throws', async () => {
  await assert.rejects(() => eventsRepo.createEvent({ type: 'open' }));
  await assert.rejects(() => eventsRepo.createEvent({ lineUserId: 'U1' }));
});
