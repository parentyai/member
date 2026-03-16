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
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');

test('phase798: cityPacksRepo dual-writes generated_view canonical core event and stamps recordEnvelope', async (t) => {
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

  await cityPacksRepo.createCityPack({
    id: 'cp_phase798',
    name: 'Austin Pack',
    status: 'draft',
    sourceRefs: ['sr_phase798_1', 'sr_phase798_2'],
    description: 'City pack draft',
    targetingRules: [{ field: 'regionKey', op: 'eq', value: 'tx::austin', effect: 'include' }],
    language: 'ja',
    modules: ['schools'],
    metadata: {
      countryCode: 'US',
      regionKey: 'tx::austin'
    }
  });

  await cityPacksRepo.updateCityPack('cp_phase798', {
    status: 'active',
    description: 'City pack active',
    modules: ['schools', 'housing']
  });

  const cityPackDoc = db._state.collections.city_packs.docs.cp_phase798.data;
  assert.ok(cityPackDoc.recordEnvelope && typeof cityPackDoc.recordEnvelope === 'object');
  assert.equal(cityPackDoc.recordEnvelope.record_id, 'cp_phase798');
  assert.equal(cityPackDoc.recordEnvelope.record_type, 'city_pack');
  assert.equal(cityPackDoc.recordEnvelope.source_snapshot_ref, 'city_packs:cp_phase798');

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs).map((doc) => doc.data).filter((row) => row.objectId === 'city_pack:cp_phase798');
  assert.ok(rows.length >= 1);
  const latest = rows.find((row) => row.payloadSummary && row.payloadSummary.status === 'active') || rows[rows.length - 1];
  assert.equal(latest.objectType, 'generated_view');
  assert.equal(latest.payloadSummary.status, 'active');
  assert.equal(latest.payloadSummary.locale, 'ja');
  assert.equal(latest.canonicalPayload.viewType, 'city_pack');
  assert.equal(latest.canonicalPayload.countryCode, 'US');
  assert.equal(latest.canonicalPayload.scopeKey, 'tx::austin');
  assert.deepEqual(latest.materializationHints.targetTables, ['generated_view']);
  assert.equal(latest.sourceLinks.length, 2);
  assert.equal(latest.sourceLinks[0].sourceId, 'sr_phase798_1');
});
