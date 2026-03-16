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
const sourceEvidenceRepo = require('../../src/repos/firestore/sourceEvidenceRepo');

test('phase795: sourceEvidenceRepo dual-writes canonical core outbox when feature flag is enabled', async (t) => {
  const previousDualWrite = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'true';
  t.after(() => {
    if (previousDualWrite === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = previousDualWrite;
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const created = await sourceEvidenceRepo.createEvidence({
    id: 'se_phase795',
    sourceRefId: 'sr_phase795',
    checkedAt: '2026-03-10T00:00:00.000Z',
    result: 'ok',
    traceId: 'trace_phase795'
  });

  assert.equal(created.id, 'se_phase795');
  const sourceEvidenceCollection = db._state.collections.source_evidence;
  assert.ok(sourceEvidenceCollection, 'source_evidence collection must exist');
  const sourceEvidenceDoc = sourceEvidenceCollection.docs.se_phase795.data;
  assert.equal(sourceEvidenceDoc.recordEnvelope.record_type, 'evidence_claim');
  assert.equal(sourceEvidenceDoc.recordEnvelope.source_snapshot_ref, 'source_evidence:se_phase795');

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs).map((doc) => doc.data).filter((row) => row.objectId === 'se_phase795');
  assert.ok(rows.length >= 1, 'source evidence dual-write must emit at least one outbox event');
  const latest = rows[rows.length - 1];
  assert.equal(latest.objectType, 'evidence_claim');
  assert.equal(latest.eventType, 'upsert');
  assert.equal(latest.sourceSystem, 'member_firestore');
  assert.equal(latest.sinkStatus, 'pending');
  assert.equal(latest.traceId, 'trace_phase795');
  assert.equal(latest.payloadSummary.lifecycleState, 'approved');
  assert.equal(latest.payloadSummary.lifecycleBucket, 'approved_knowledge');
  assert.deepEqual(latest.materializationHints.targetTables, ['evidence_claim']);
  assert.equal(latest.canonicalPayload.evidenceClaim.canonicalKey, 'evidence_claim:se_phase795');
  assert.equal(latest.sourceLinks[0].sourceId, 'sr_phase795');
});
