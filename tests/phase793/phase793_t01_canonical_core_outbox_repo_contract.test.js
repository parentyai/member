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
const { appendCanonicalCoreOutboxEvent } = require('../../src/repos/firestore/canonicalCoreOutboxRepo');

function buildEnvelope() {
  return {
    record_id: 'sr_1',
    record_type: 'source_ref',
    source_system: 'member_firestore',
    source_snapshot_ref: 'source_ref:abc123',
    effective_from: '2026-03-10T00:00:00.000Z',
    effective_to: null,
    authority_tier: 'T1_OFFICIAL_OPERATION',
    binding_level: 'POLICY',
    jurisdiction: 'us-ny',
    status: 'active',
    retention_tag: 'source_refs_365d',
    pii_class: 'none',
    access_scope: ['operator'],
    masking_policy: 'none',
    deletion_policy: 'retention_policy_v1',
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z'
  };
}

test('phase793: canonical core outbox skips write when dual-write flag is disabled', async (t) => {
  const previous = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = previous;
  });

  const result = await appendCanonicalCoreOutboxEvent({
    objectType: 'source_snapshot',
    objectId: 'sr_1',
    eventType: 'upsert',
    recordEnvelope: buildEnvelope(),
    payloadSummary: { lifecycleState: 'approved' }
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'dual_write_disabled');
});

test('phase793: canonical core outbox writes normalized pending event when dual-write flag is enabled', async (t) => {
  const previous = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = previous;
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const result = await appendCanonicalCoreOutboxEvent({
    objectType: 'source_snapshot',
    objectId: 'sr_1',
    eventType: 'upsert',
    recordEnvelope: buildEnvelope(),
    payloadSummary: { lifecycleState: 'approved', lifecycleBucket: 'approved_knowledge', status: 'active' }
  });

  assert.equal(result.skipped, false);
  assert.match(result.id, /^cco_/);
  const collection = db._state.collections.canonical_core_outbox;
  assert.ok(collection);
  const row = collection.docs[result.id].data;
  assert.equal(row.objectType, 'source_snapshot');
  assert.equal(row.objectId, 'sr_1');
  assert.equal(row.eventType, 'upsert');
  assert.equal(row.sinkStatus, 'pending');
  assert.equal(row.createdAt, 'SERVER_TIMESTAMP');
  assert.equal(row.updatedAt, 'SERVER_TIMESTAMP');
});
