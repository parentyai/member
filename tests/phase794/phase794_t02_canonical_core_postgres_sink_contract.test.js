'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  upsertCanonicalCoreObject
} = require('../../src/domain/data/canonicalCorePostgresSink');

test('phase794: postgres sink skips when feature flag is disabled', async (t) => {
  const prevEnabled = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTypedEnabled = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
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

  const result = await upsertCanonicalCoreObject({
    objectType: 'source_snapshot',
    objectId: 'sr_1'
  }, {
    pool: {
      query: async () => ({ rows: [] })
    }
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'postgres_sink_disabled');
});

test('phase794: postgres sink upserts canonical row and returns canonical record id when enabled', async (t) => {
  const prevEnabled = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTypedEnabled = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'false';
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
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
    objectType: 'source_snapshot',
    objectId: 'sr_101',
    eventType: 'upsert',
    sourceSnapshotRef: 'source_ref:sr_101',
    payloadSummary: { lifecycleState: 'approved' },
    recordEnvelope: { status: 'active' },
    contractVersion: 'canonical_core_outbox_v2',
    canonicalPayload: { canonicalKey: 'source_snapshot:sr_101' },
    sourceLinks: [{ sourceId: 'src_101', snapshotRef: 'source_ref:sr_101', linkRole: 'supports', primary: true }],
    materializationHints: { targetTables: ['source_snapshot'] }
  }, {
    pool: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        return {
          rows: [{ object_type: 'source_snapshot', object_id: 'sr_101' }]
        };
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.canonicalRecordId, 'source_snapshot:sr_101');
  assert.equal(result.typedMaterialization.enabled, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO canonical_core_objects/i);
  assert.equal(calls[0].values[0], 'source_snapshot');
  assert.equal(calls[0].values[1], 'sr_101');
  assert.equal(calls[0].values.length, 13);
});

test('phase794: postgres sink materializes typed tables when typed materializer flag is enabled', async (t) => {
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
    objectType: 'source_snapshot',
    objectId: 'sr_301',
    eventType: 'upsert',
    sourceSnapshotRef: 'source_ref:hash301',
    payloadSummary: { lifecycleState: 'approved' },
    recordEnvelope: { status: 'active' },
    canonicalPayload: {
      sourceRegistry: {
        sourceId: 'sr_301',
        canonicalKey: 'source_registry:sr_301',
        sourceName: 'example.gov',
        ownerOrg: 'example.gov',
        authorityTier: 'T1',
        bindingLevel: 'policy_bound',
        countryCode: 'US',
        scopeKey: 'US_CA',
        domain: 'gov',
        canonicalUrl: 'https://example.gov/ca',
        freshnessSlaDays: 30,
        reviewerStatus: 'approved',
        activeFlag: true,
        staleFlag: false,
        metadata: {}
      },
      sourceSnapshot: {
        canonicalKey: 'source_snapshot:sr_301:hash301',
        sourceId: 'sr_301',
        fetchUrl: 'https://example.gov/ca',
        contentHash: 'hash301',
        observedAt: '2026-03-16T00:00:00.000Z',
        parseStatus: 'active',
        isLatest: true,
        extractedJson: {},
        diffSummary: {},
        metadata: {}
      }
    },
    materializationHints: { targetTables: ['source_registry', 'source_snapshot'] }
  }, {
    pool: {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (/INSERT INTO canonical_core_objects/i.test(sql)) {
          return { rows: [{ object_type: 'source_snapshot', object_id: 'sr_301' }] };
        }
        if (/INSERT INTO source_registry/i.test(sql)) {
          return { rows: [{ source_id: 'sr_301' }] };
        }
        if (/INSERT INTO source_snapshot/i.test(sql)) {
          return { rows: [{ snapshot_id: '11111111-1111-5111-8111-111111111111' }] };
        }
        throw new Error('unexpected sql');
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.canonicalRecordId, 'source_snapshot:sr_301');
  assert.equal(result.typedMaterialization.enabled, true);
  assert.deepEqual(
    result.typedMaterialization.tables.map((row) => row.table),
    ['source_registry', 'source_snapshot']
  );
  assert.equal(calls.length, 3);
});

test('phase794: postgres sink throws in strict mode when query fails', async (t) => {
  const prevEnabled = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTypedEnabled = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'true';
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
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

  await assert.rejects(
    () => upsertCanonicalCoreObject({
      objectType: 'source_snapshot',
      objectId: 'sr_202'
    }, {
      pool: {
        query: async () => {
          const err = new Error('connection failed');
          err.code = 'ECONNFAILED';
          throw err;
        }
      }
    }),
    /connection failed/
  );
});
