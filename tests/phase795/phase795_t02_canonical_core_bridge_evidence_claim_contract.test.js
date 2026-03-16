'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildCanonicalCoreOutboxEvent,
  DEFAULT_CANONICAL_CORE_OUTBOX_CONTRACT_VERSION
} = require('../../src/domain/data/canonicalCoreBridge');

function buildEnvelope() {
  return {
    record_id: 'se_1',
    record_type: 'evidence_claim',
    source_system: 'member_firestore',
    source_snapshot_ref: 'source_evidence:se_1',
    effective_from: '2026-03-10T00:00:00.000Z',
    effective_to: null,
    authority_tier: 'UNKNOWN',
    binding_level: 'REFERENCE',
    jurisdiction: null,
    status: 'active',
    retention_tag: 'source_evidence_indefinite',
    pii_class: 'none',
    access_scope: ['operator', 'audit'],
    masking_policy: 'none',
    deletion_policy: 'retention_policy_v1',
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z'
  };
}

test('phase795: canonical core bridge preserves evidence_claim object type', () => {
  const event = buildCanonicalCoreOutboxEvent({
    objectType: 'evidence_claim',
    objectId: 'se_1',
    eventType: 'upsert',
    recordEnvelope: buildEnvelope(),
    payloadSummary: { lifecycleState: 'candidate', lifecycleBucket: 'candidate_knowledge', status: 'ok' },
    traceId: 'trace_phase795_bridge'
  });

  assert.equal(event.objectType, 'evidence_claim');
  assert.equal(event.objectId, 'se_1');
  assert.equal(event.eventType, 'upsert');
  assert.equal(event.sourceSnapshotRef, 'source_evidence:se_1');
  assert.equal(event.contractVersion, DEFAULT_CANONICAL_CORE_OUTBOX_CONTRACT_VERSION);
});

test('phase795: canonical core bridge v2 foundation preserves typed payload, links, and new object types', () => {
  const event = buildCanonicalCoreOutboxEvent({
    contractVersion: 'canonical_core_outbox_v2',
    objectType: 'generated_view',
    objectId: 'gv_1',
    eventType: 'status_change',
    recordEnvelope: buildEnvelope(),
    canonicalPayload: {
      viewType: 'city_pack',
      locale: 'ja',
      activeFlag: true
    },
    sourceLinks: [
      { sourceId: 'src_1', snapshotRef: 'snap_1', linkRole: 'supports', primary: true },
      { sourceId: 'src_1', snapshotRef: 'snap_1', linkRole: 'supports', primary: true }
    ],
    materializationHints: {
      targetTables: ['generated_view', 'generated_view', 'exception_playbook']
    }
  });

  assert.equal(event.objectType, 'generated_view');
  assert.equal(event.contractVersion, 'canonical_core_outbox_v2');
  assert.equal(event.canonicalPayload.viewType, 'city_pack');
  assert.equal(event.sourceLinks.length, 1);
  assert.deepEqual(event.materializationHints.targetTables, ['generated_view', 'exception_playbook']);
});
