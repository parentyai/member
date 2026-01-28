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

const { logEventBestEffort } = require('../../src/usecases/events/logEvent');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('events integration: open requires notificationId', async () => {
  const res = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'open',
    ref: {}
  });
  assert.strictEqual(res.ok, false);
});

test('events integration: click requires notificationId', async () => {
  const res = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'click',
    ref: { checklistId: 'C1' }
  });
  assert.strictEqual(res.ok, false);
});

test('events integration: complete requires checklistId + itemId', async () => {
  const res = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'complete',
    ref: { checklistId: 'C1' }
  });
  assert.strictEqual(res.ok, false);
});
