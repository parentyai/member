'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const repo = require('../../src/repos/firestore/kpiSnapshotsReadRepo');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
});

afterEach(() => {
  clearDbForTest();
});

test('phase22 t06: limit and order applied', async () => {
  await db.collection('phase22_kpi_snapshots').doc('a').set({ createdAt: 1, ctaA: 'openA', ctaB: 'openB' });
  await db.collection('phase22_kpi_snapshots').doc('b').set({ createdAt: 2, ctaA: 'openA', ctaB: 'openB' });
  await db.collection('phase22_kpi_snapshots').doc('c').set({ createdAt: 3, ctaA: 'openA', ctaB: 'openB' });

  const docs = await repo.listSnapshots({ order: 'desc', limit: 2 });
  assert.strictEqual(docs.length, 2);
  assert.strictEqual(docs[0].createdAt, 3);
  assert.strictEqual(docs[1].createdAt, 2);
});

test('phase22 t06: cta filters applied', async () => {
  await db.collection('phase22_kpi_snapshots').doc('a').set({ createdAt: 1, ctaA: 'openA', ctaB: 'openB' });
  await db.collection('phase22_kpi_snapshots').doc('b').set({ createdAt: 2, ctaA: 'openA', ctaB: 'other' });

  const docs = await repo.listSnapshots({ ctaA: 'openA', ctaB: 'openB', order: 'desc', limit: 20 });
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].ctaB, 'openB');
});
