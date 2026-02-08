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

const repo = require('../../src/repos/firestore/opsAssistCacheRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase46: ops assist cache stores latest entry', async () => {
  await repo.appendOpsAssistCache({ lineUserId: 'U1', suggestion: 'NO_ACTION', reason: 'default' });
  setServerTimestampForTest('2026-02-08T01:00:00Z');
  await repo.appendOpsAssistCache({ lineUserId: 'U1', suggestion: 'RERUN_MAIN', reason: 'retry' });

  const latest = await repo.getLatestOpsAssistCache('U1');
  assert.strictEqual(latest.lineUserId, 'U1');
  assert.strictEqual(latest.suggestion, 'RERUN_MAIN');
  assert.strictEqual(latest.createdAt, '2026-02-08T01:00:00Z');
});
