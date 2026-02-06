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

const repo = require('../../src/repos/firestore/phase22KpiSnapshotsRepo');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase22 t05: upsertSnapshot sets createdAt serverTimestamp', async () => {
  await repo.upsertSnapshot('doc1', { foo: 'bar' });
  const doc = db._state.collections.phase22_kpi_snapshots.docs.doc1;
  assert.strictEqual(doc.data.createdAt, 'SERVER_TIMESTAMP');
});

test('phase22 t05: upsertSnapshot uses merge true', async () => {
  await repo.upsertSnapshot('doc2', { foo: 'bar' });
  const doc = db._state.collections.phase22_kpi_snapshots.docs.doc2;
  assert.strictEqual(doc.options.merge, true);
});
