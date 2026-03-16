'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  upsertCanonicalCoreObject
} = require('../../src/domain/data/canonicalCorePostgresSink');

test('phase800: postgres sink materializes exception_playbook typed table when enabled', async (t) => {
  const prevEnabled = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTypedEnabled = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'false';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = 'false';
  t.after(() => {
    if (prevEnabled === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = prevEnabled;
    if (prevStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = prevStrict;
    if (prevTypedEnabled === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = prevTypedEnabled;
    if (prevTypedStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = prevTypedStrict;
  });

  const calls = [];
  const result = await upsertCanonicalCoreObject({
    objectType: 'exception_playbook',
    objectId: 'exception_playbook:ops_escalate',
    eventType: 'upsert',
    sourceSnapshotRef: 'notification_templates:tpl_ops_escalate',
    payloadSummary: { lifecycleState: 'approved', status: 'active', riskLevel: 'high' },
    recordEnvelope: { status: 'active' },
    contractVersion: 'canonical_core_outbox_v2',
    canonicalPayload: {
      exceptionPlaybook: {
        exceptionId: '11111111-1111-5111-8111-111111111111',
        canonicalKey: 'exception_playbook:ops_escalate',
        exceptionCode: 'ops_escalate',
        title: 'Escalate to Ops',
        domain: 'ops',
        topic: 'delivery_failure',
        countryCode: 'US',
        scopeKey: 'GLOBAL',
        audienceScope: [],
        householdScope: [],
        visaScope: [],
        severity: 'high',
        symptomPatterns: ['push persisted failed'],
        fallbackSteps: ['seal delivery'],
        escalationContacts: { queue: 'ops-primary' },
        authorityFloor: 'T3',
        reviewerStatus: 'approved',
        activeFlag: true,
        staleFlag: false,
        metadata: {
          templateId: 'tpl_ops_escalate',
          templateKey: 'ops_escalate'
        }
      }
    },
    materializationHints: { targetTables: ['exception_playbook'] }
  }, {
    pool: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (/INSERT INTO canonical_core_objects/i.test(sql)) {
          return { rows: [{ object_type: 'exception_playbook', object_id: 'exception_playbook:ops_escalate' }] };
        }
        if (/INSERT INTO exception_playbook/i.test(sql)) {
          return { rows: [{ exception_id: '11111111-1111-5111-8111-111111111111' }] };
        }
        throw new Error('unexpected sql');
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.canonicalRecordId, 'exception_playbook:exception_playbook:ops_escalate');
  assert.equal(result.typedMaterialization.enabled, true);
  assert.deepEqual(
    result.typedMaterialization.tables.map((row) => row.table),
    ['exception_playbook']
  );
  assert.equal(calls.length, 2);
});
