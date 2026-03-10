'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const {
  listCanonicalCoreOutboxEvents,
  markCanonicalCoreOutboxEventSynced,
  markCanonicalCoreOutboxEventFailed
} = require('../../src/repos/firestore/canonicalCoreOutboxRepo');

test('phase794: canonical core outbox lists pending rows and updates synced/failed status', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('canonical_core_outbox').doc('cco_pending_1').set({
    sinkStatus: 'pending',
    objectType: 'source_snapshot',
    objectId: 'sr_1',
    eventType: 'upsert',
    createdAt: '2026-03-10T00:00:01.000Z'
  }, { merge: true });
  await db.collection('canonical_core_outbox').doc('cco_pending_2').set({
    sinkStatus: 'pending',
    objectType: 'knowledge_object',
    objectId: 'faq_2',
    eventType: 'upsert',
    createdAt: '2026-03-10T00:00:00.000Z'
  }, { merge: true });
  await db.collection('canonical_core_outbox').doc('cco_synced_1').set({
    sinkStatus: 'synced',
    objectType: 'source_snapshot',
    objectId: 'sr_3',
    eventType: 'upsert',
    createdAt: '2026-03-10T00:00:02.000Z'
  }, { merge: true });

  const pending = await listCanonicalCoreOutboxEvents({ status: 'pending', limit: 10 });
  assert.equal(pending.length, 2);
  assert.deepEqual(pending.map((row) => row.id), ['cco_pending_2', 'cco_pending_1']);

  const syncedResult = await markCanonicalCoreOutboxEventSynced('cco_pending_1', { canonicalRecordId: 'source_snapshot:sr_1' });
  assert.equal(syncedResult.sinkStatus, 'synced');
  const rowSynced = (await db.collection('canonical_core_outbox').doc('cco_pending_1').get()).data();
  assert.equal(rowSynced.sinkStatus, 'synced');
  assert.equal(rowSynced.canonicalRecordId, 'source_snapshot:sr_1');
  assert.equal(rowSynced.syncedAt, 'SERVER_TIMESTAMP');

  const failedResult = await markCanonicalCoreOutboxEventFailed('cco_pending_2', {
    code: 'ECONNRESET',
    message: 'temporary network failure'
  });
  assert.equal(failedResult.sinkStatus, 'failed');
  const rowFailed = (await db.collection('canonical_core_outbox').doc('cco_pending_2').get()).data();
  assert.equal(rowFailed.sinkStatus, 'failed');
  assert.equal(rowFailed.sinkErrorCode, 'ECONNRESET');
  assert.equal(rowFailed.sinkErrorMessage, 'temporary network failure');
  assert.equal(rowFailed.failedAt, 'SERVER_TIMESTAMP');
});
