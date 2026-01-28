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

test('logEventBestEffort: enforces type constraints', async () => {
  const missing = await logEventBestEffort({
    lineUserId: 'U1',
    type: 'open',
    ref: {}
  });
  assert.strictEqual(missing.ok, false);
});
