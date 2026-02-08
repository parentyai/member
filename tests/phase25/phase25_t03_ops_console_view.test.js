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
const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase25 t03: ops console returns required keys', async () => {
  await usersRepo.createUser('U1', { memberNumber: 'ABC1234', createdAt: '2000-01-01T00:00:00Z' });

  const result = await getOpsConsole({ lineUserId: 'U1' });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.lineUserId, 'U1');
  assert.ok(typeof result.serverTime === 'string');
  assert.ok(result.userStateSummary);
  assert.ok(result.memberSummary);
  assert.ok(result.readiness);
  assert.ok(typeof result.closeDecision === 'string');
  assert.ok(typeof result.closeReason === 'string');
  assert.ok(typeof result.phaseResult === 'string');
  assert.strictEqual(result.opsState, null);
  assert.strictEqual(result.latestDecisionLog, null);
});
