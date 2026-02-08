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

const { getAutomationConfig } = require('../../src/usecases/phase48/getAutomationConfig');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase48: automation config default disabled', async () => {
  const result = await getAutomationConfig();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.config.enabled, false);
});
