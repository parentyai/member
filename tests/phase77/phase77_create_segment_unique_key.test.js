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

const opsSegmentsRepo = require('../../src/repos/firestore/opsSegmentsRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase77: create segment enforces unique key', async () => {
  await opsSegmentsRepo.createSegment({
    segmentKey: 'ready_only',
    label: 'READY only',
    filter: { readinessStatus: 'READY' },
    status: 'active'
  });

  await assert.rejects(async () => {
    await opsSegmentsRepo.createSegment({
      segmentKey: 'ready_only',
      label: 'READY only',
      filter: { readinessStatus: 'READY' },
      status: 'active'
    });
  }, /segment exists/);
});
