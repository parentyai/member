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
const { getUsersSummaryFiltered } = require('../../src/usecases/phase5/getUsersSummaryFiltered');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing', async () => {
  const items = await getUsersSummaryFiltered({
    snapshotMode: 'require'
  });
  assert.deepStrictEqual(items, []);
});
