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

const { generateOpsDailyReport } = require('../../src/usecases/phase62/generateOpsDailyReport');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase62: same date is idempotent', async () => {
  const listOpsConsole = async () => ({ items: [] });

  await generateOpsDailyReport({ date: '2026-02-08' }, { listOpsConsole });
  await generateOpsDailyReport({ date: '2026-02-08' }, { listOpsConsole });

  const collection = db._state.collections.ops_daily_reports;
  assert.ok(collection);
  assert.strictEqual(Object.keys(collection.docs).length, 1);
});
