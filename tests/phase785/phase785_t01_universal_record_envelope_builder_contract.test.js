'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildUniversalRecordEnvelope } = require('../../src/domain/data/universalRecordEnvelope');

test('phase785: universal record envelope builder fills required keys with normalized defaults', () => {
  const envelope = buildUniversalRecordEnvelope({
    recordId: 'row_1',
    recordType: 'llm_action_log',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:row_1',
    authorityTier: 't1_official_operation',
    bindingLevel: 'policy',
    accessScope: ['operator', 'operator', 'llm_runtime']
  });

  assert.equal(envelope.record_id, 'row_1');
  assert.equal(envelope.record_type, 'llm_action_log');
  assert.equal(envelope.source_system, 'member_firestore');
  assert.equal(envelope.source_snapshot_ref, 'snapshot:row_1');
  assert.equal(envelope.authority_tier, 'T1_OFFICIAL_OPERATION');
  assert.equal(envelope.binding_level, 'POLICY');
  assert.equal(envelope.status, 'active');
  assert.ok(typeof envelope.effective_from === 'string' && envelope.effective_from.length > 0);
  assert.ok(typeof envelope.created_at === 'string' && envelope.created_at.length > 0);
  assert.ok(typeof envelope.updated_at === 'string' && envelope.updated_at.length > 0);
  assert.deepEqual(envelope.access_scope, ['operator', 'llm_runtime']);
});
