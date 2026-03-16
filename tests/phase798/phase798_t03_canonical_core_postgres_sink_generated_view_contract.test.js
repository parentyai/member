'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  upsertCanonicalCoreObject
} = require('../../src/domain/data/canonicalCorePostgresSink');

test('phase798: postgres sink materializes generated_view sidecar when typed materializer is enabled', async (t) => {
  const prevSink = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevSinkStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTyped = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'false';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = 'false';
  t.after(() => {
    if (prevSink === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = prevSink;
    if (prevSinkStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = prevSinkStrict;
    if (prevTyped === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = prevTyped;
    if (prevTypedStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = prevTypedStrict;
  });

  const calls = [];
  const result = await upsertCanonicalCoreObject({
    objectType: 'generated_view',
    objectId: 'city_pack:cp_phase798',
    eventType: 'upsert',
    sourceSnapshotRef: 'city_packs:cp_phase798',
    payloadSummary: { status: 'active', locale: 'ja' },
    recordEnvelope: {
      record_id: 'cp_phase798',
      record_type: 'city_pack',
      source_system: 'member_firestore',
      source_snapshot_ref: 'city_packs:cp_phase798',
      effective_from: '2026-03-16T00:00:00.000Z',
      effective_to: null,
      authority_tier: 'UNKNOWN',
      binding_level: 'REFERENCE',
      jurisdiction: 'tx::austin',
      status: 'active',
      retention_tag: 'city_packs_indefinite',
      pii_class: 'none',
      access_scope: ['operator', 'retrieval'],
      masking_policy: 'none',
      deletion_policy: 'retention_policy_v1',
      created_at: '2026-03-16T00:00:00.000Z',
      updated_at: '2026-03-16T00:00:00.000Z'
    },
    canonicalPayload: {
      viewType: 'city_pack',
      canonicalKey: 'city_pack:cp_phase798:ja',
      viewKey: 'city_pack:cp_phase798',
      locale: 'ja',
      countryCode: 'US',
      scopeKey: 'tx::austin',
      title: 'Austin Pack',
      authorityFloor: 'T4',
      bindingLevel: 'informative',
      freshnessSlaDays: 120,
      renderPayload: { modules: ['schools'] },
      fromObjectIds: ['cp_phase798']
    },
    materializationHints: {
      targetTables: ['generated_view']
    }
  }, {
    pool: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (/INSERT INTO canonical_core_objects/i.test(sql)) {
          return { rows: [{ object_type: 'generated_view', object_id: 'city_pack:cp_phase798' }] };
        }
        if (/INSERT INTO generated_view/i.test(sql)) {
          return { rows: [{ view_id: '11111111-1111-1111-1111-111111111111' }] };
        }
        throw new Error('unexpected query');
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.canonicalRecordId, 'generated_view:city_pack:cp_phase798');
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO canonical_core_objects/i);
  assert.match(calls[1].sql, /INSERT INTO generated_view/i);
  assert.equal(result.typedMaterialization.enabled, true);
  assert.equal(result.typedMaterialization.tables[0].table, 'generated_view');
  assert.equal(result.typedMaterialization.tables[0].status, 'materialized');
});

test('phase798: postgres sink reports generated_view skip reason when countryCode is missing', async (t) => {
  const prevSink = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevSinkStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTyped = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'false';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = 'false';
  t.after(() => {
    if (prevSink === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = prevSink;
    if (prevSinkStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = prevSinkStrict;
    if (prevTyped === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = prevTyped;
    if (prevTypedStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = prevTypedStrict;
  });

  const calls = [];
  const result = await upsertCanonicalCoreObject({
    objectType: 'generated_view',
    objectId: 'city_pack:cp_phase798_missing_country',
    eventType: 'upsert',
    sourceSnapshotRef: 'city_packs:cp_phase798_missing_country',
    recordEnvelope: {
      record_id: 'cp_phase798_missing_country',
      record_type: 'city_pack',
      source_system: 'member_firestore',
      source_snapshot_ref: 'city_packs:cp_phase798_missing_country',
      effective_from: '2026-03-16T00:00:00.000Z',
      effective_to: null,
      authority_tier: 'UNKNOWN',
      binding_level: 'REFERENCE',
      jurisdiction: null,
      status: 'draft',
      retention_tag: 'city_packs_indefinite',
      pii_class: 'none',
      access_scope: ['operator', 'retrieval'],
      masking_policy: 'none',
      deletion_policy: 'retention_policy_v1',
      created_at: '2026-03-16T00:00:00.000Z',
      updated_at: '2026-03-16T00:00:00.000Z'
    },
    canonicalPayload: {
      viewType: 'city_pack',
      canonicalKey: 'city_pack:cp_phase798_missing_country:ja',
      viewKey: 'city_pack:cp_phase798_missing_country',
      locale: 'ja',
      title: 'Draft Pack',
      authorityFloor: 'T4',
      bindingLevel: 'informative',
      freshnessSlaDays: 120
    },
    materializationHints: {
      targetTables: ['generated_view']
    }
  }, {
    pool: {
      query: async (sql) => {
        calls.push(sql);
        return { rows: [{ object_type: 'generated_view', object_id: 'city_pack:cp_phase798_missing_country' }] };
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(calls.length, 1);
  assert.equal(result.typedMaterialization.tables[0].table, 'generated_view');
  assert.equal(result.typedMaterialization.tables[0].status, 'skipped');
  assert.equal(result.typedMaterialization.tables[0].reason, 'country_code_missing');
});
