'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { buildUniversalRecordEnvelope } = require('../../src/domain/data/universalRecordEnvelope');
const {
  assertRecordEnvelopeCompliance,
  resolveEnvelopeAdoptionState
} = require('../../src/domain/data/universalRecordEnvelopeCompliance');

afterEach(() => {
  delete process.env.ENABLE_DATA_ENVELOPE_ENFORCED_V1;
});

test('phase791: DATA-C-02 envelope compliance is enforced by default', () => {
  const envelope = buildUniversalRecordEnvelope({
    recordId: 'row_phase791',
    recordType: 'llm_action_log',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef: 'snapshot:phase791',
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'RECOMMENDED',
    status: 'active',
    retentionTag: 'llm_action_logs_180d',
    piiClass: 'indirect_identifier',
    accessScope: ['operator'],
    maskingPolicy: 'trace_summary_masked',
    deletionPolicy: 'retention_policy_v1'
  });
  assert.equal(resolveEnvelopeAdoptionState('llm_action_logs'), 'enforced');
  const result = assertRecordEnvelopeCompliance({ dataClass: 'llm_action_logs', recordEnvelope: envelope });
  assert.equal(result.enforced, true);
  assert.equal(result.ok, true);
});

test('phase791: DATA-C-02 envelope compliance rejects missing required keys in enforced mode', () => {
  assert.throws(() => {
    assertRecordEnvelopeCompliance({
      dataClass: 'faq_answer_logs',
      recordEnvelope: { record_id: 'missing_fields' }
    });
  }, /RECORD_ENVELOPE_COMPLIANCE_FAILED|recordEnvelope compliance failed/);
});

test('phase791: envelope enforcement can be downgraded to shadow_write for rollback', () => {
  process.env.ENABLE_DATA_ENVELOPE_ENFORCED_V1 = 'false';
  assert.equal(resolveEnvelopeAdoptionState('source_refs'), 'shadow_write');
  const result = assertRecordEnvelopeCompliance({
    dataClass: 'source_refs',
    recordEnvelope: { record_id: 'incomplete' }
  });
  assert.equal(result.enforced, false);
  assert.equal(result.ok, true);
});

