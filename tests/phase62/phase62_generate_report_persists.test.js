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

test('phase62: generate report persists summary', async () => {
  const listOpsConsole = async () => ({
    items: [
      { lineUserId: 'U1', readiness: { status: 'READY' } },
      { lineUserId: 'U2', readiness: { status: 'NOT_READY' } },
      { lineUserId: 'U3', readiness: { status: 'READY' } }
    ]
  });

  const result = await generateOpsDailyReport({ date: '2026-02-08' }, { listOpsConsole });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.counts.ready, 2);
  assert.strictEqual(result.counts.notReady, 1);

  const snap = await db.collection('ops_daily_reports').doc('2026-02-08').get();
  assert.strictEqual(snap.exists, true);
  const data = snap.data();
  assert.strictEqual(data.date, '2026-02-08');
  assert.strictEqual(data.generatedAt, '2026-02-08T00:00:00Z');
  assert.deepStrictEqual(data.topReady, ['U1', 'U3']);
});
