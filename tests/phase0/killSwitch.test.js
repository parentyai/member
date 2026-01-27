'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest
} = require('../../src/infra/firestore');

const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
});

afterEach(() => {
  clearDbForTest();
});

test('killSwitch: default false, set true', async () => {
  const initial = await systemFlagsRepo.getKillSwitch();
  assert.strictEqual(initial, false);

  await systemFlagsRepo.setKillSwitch(true);
  const next = await systemFlagsRepo.getKillSwitch();
  assert.strictEqual(next, true);
});
