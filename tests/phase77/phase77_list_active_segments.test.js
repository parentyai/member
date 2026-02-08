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

const { listOpsSegments } = require('../../src/usecases/phase77/listOpsSegments');
const opsSegmentsRepo = require('../../src/repos/firestore/opsSegmentsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase77: list active segments returns active only', async () => {
  await opsSegmentsRepo.createSegment({
    segmentKey: 'ready_only',
    label: 'READY only',
    filter: { readinessStatus: 'READY' },
    status: 'active'
  });
  await opsSegmentsRepo.createSegment({
    segmentKey: 'archived',
    label: 'archived',
    filter: {},
    status: 'archived'
  });

  const result = await listOpsSegments({ status: 'active' }, {});
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].segmentKey, 'ready_only');
});
