'use strict';

const assert = require('assert');
const { beforeEach, afterEach, test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { getNotificationsSummaryFiltered } = require('../../src/usecases/phase5/getNotificationsSummaryFiltered');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing', async () => {
  const items = await getNotificationsSummaryFiltered({
    snapshotMode: 'require'
  });
  assert.deepStrictEqual(items, []);
});
