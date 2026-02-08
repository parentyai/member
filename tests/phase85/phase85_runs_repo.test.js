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
const { createRun, patchRun, getRun } = require('../../src/repos/firestore/automationRunsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase85: automation_runs repo create/patch/get', async () => {
  const created = await createRun({
    kind: 'SEGMENT_SEND',
    status: 'PENDING',
    counters: { total: 10, attempted: 0, success: 0, failed: 0, skipped: 0 }
  });
  assert.ok(created.id);

  await patchRun(created.id, { status: 'RUNNING', cursor: { index: 5, lastUserId: 'U5' } });

  const run = await getRun(created.id);
  assert.strictEqual(run.status, 'RUNNING');
  assert.strictEqual(run.kind, 'SEGMENT_SEND');
  assert.strictEqual(run.cursor.index, 5);
  assert.strictEqual(run.cursor.lastUserId, 'U5');
  assert.strictEqual(run.createdAt, '2026-02-08T00:00:00Z');
});
