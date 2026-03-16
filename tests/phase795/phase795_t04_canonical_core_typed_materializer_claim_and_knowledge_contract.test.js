'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  upsertCanonicalCoreObject
} = require('../../src/domain/data/canonicalCorePostgresSink');

test('phase795: typed materializer upserts evidence_claim and knowledge_object sidecars', async (t) => {
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
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (/INSERT INTO canonical_core_objects/i.test(sql)) {
        return { rows: [{ object_type: values[0], object_id: values[1] }] };
      }
      if (/INSERT INTO evidence_claim/i.test(sql)) {
        return { rows: [{ claim_id: '11111111-1111-5111-8111-111111111111' }] };
      }
      if (/INSERT INTO knowledge_object/i.test(sql)) {
        return { rows: [{ object_id: '22222222-2222-5222-8222-222222222222' }] };
      }
      throw new Error('unexpected sql');
    }
  };

  const evidence = await upsertCanonicalCoreObject({
    objectType: 'evidence_claim',
    objectId: 'se_401',
    eventType: 'upsert',
    canonicalPayload: {
      evidenceClaim: {
        canonicalKey: 'evidence_claim:se_401',
        claimType: 'source_audit_result',
        title: 'source evidence se_401',
        claimText: 'source audit result: ok',
        normalizedFact: { result: 'ok' },
        countryCode: 'TBD',
        scopeKey: 'GLOBAL',
        authorityTier: 'T2',
        bindingLevel: 'informative',
        freshnessSlaDays: 30,
        reviewerStatus: 'approved',
        activeFlag: true,
        staleFlag: false,
        metadata: {}
      }
    },
    materializationHints: { targetTables: ['evidence_claim'] }
  }, { pool });

  const knowledge = await upsertCanonicalCoreObject({
    objectType: 'knowledge_object',
    objectId: 'faq_401',
    eventType: 'upsert',
    canonicalPayload: {
      knowledgeObject: {
        canonicalKey: 'knowledge_object:faq_401',
        objectType: 'faq_article',
        title: 'SSN FAQ',
        slug: 'ssn-faq',
        domain: 'faq',
        topic: 'ssn',
        countryCode: 'TBD',
        scopeKey: 'GLOBAL',
        authorityFloor: 'T1',
        bindingLevel: 'policy_bound',
        freshnessSlaDays: 30,
        reviewerStatus: 'approved',
        activeFlag: true,
        staleFlag: false,
        metadata: {}
      }
    },
    materializationHints: { targetTables: ['knowledge_object'] }
  }, { pool });

  assert.equal(evidence.skipped, false);
  assert.equal(knowledge.skipped, false);
  assert.ok(calls.some((row) => /INSERT INTO evidence_claim/i.test(row.sql)));
  assert.ok(calls.some((row) => /INSERT INTO knowledge_object/i.test(row.sql)));
  assert.deepEqual(
    evidence.typedMaterialization.tables.map((row) => row.table),
    ['evidence_claim']
  );
  assert.deepEqual(
    knowledge.typedMaterialization.tables.map((row) => row.table),
    ['knowledge_object']
  );
});
