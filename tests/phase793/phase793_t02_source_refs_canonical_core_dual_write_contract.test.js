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
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

test('phase793: sourceRefsRepo dual-writes canonical core outbox when feature flag is enabled', async (t) => {
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

  await sourceRefsRepo.createSourceRef({
    id: 'sr_phase793',
    url: 'https://example.gov/source',
    status: 'active',
    sourceType: 'official',
    riskLevel: 'low'
  });

  await sourceRefsRepo.updateSourceRef('sr_phase793', {
    status: 'retired',
    riskLevel: 'medium'
  });

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs).map((doc) => doc.data).filter((row) => row.objectId === 'sr_phase793');
  assert.ok(rows.length >= 1, 'source ref dual-write must emit at least one outbox event');
  const latest = rows[rows.length - 1];
  assert.equal(latest.objectType, 'source_snapshot');
  assert.equal(latest.sourceSystem, 'member_firestore');
  assert.equal(latest.sinkStatus, 'pending');
  assert.equal(latest.payloadSummary.lifecycleState, 'deprecated');
  assert.equal(latest.payloadSummary.lifecycleBucket, 'candidate_knowledge');
  assert.deepEqual(latest.materializationHints.targetTables, ['source_registry', 'source_snapshot']);
  assert.equal(latest.canonicalPayload.sourceRegistry.sourceId, 'sr_phase793');
  assert.equal(latest.canonicalPayload.sourceSnapshot.sourceId, 'sr_phase793');
  assert.equal(latest.sourceLinks[0].sourceId, 'sr_phase793');
});
