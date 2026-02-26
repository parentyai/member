'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  getDb,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');
const { activateCityPack } = require('../../src/usecases/cityPack/activateCityPack');

function listDocs(db, collection) {
  const col = db._state.collections[collection];
  if (!col) return [];
  return Object.entries(col.docs).map(([id, row]) => {
    const payload = row && row.data && typeof row.data === 'object' ? row.data : row;
    return Object.assign({ id }, payload);
  });
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase666: activateCityPack fails closed when school slot link is not public', async () => {
  const privateLink = await linkRegistryRepo.createLink({
    title: 'Private School',
    url: 'https://example.org/private-school',
    schoolType: 'private'
  });
  const created = await cityPacksRepo.createCityPack({
    id: 'cp_phase666_school_guard',
    name: 'City Pack',
    status: 'draft',
    sourceRefs: ['sr_dummy'],
    allowedIntents: ['CITY_PACK'],
    slotContents: {
      school: {
        description: 'School',
        ctaText: 'Open',
        linkRegistryId: privateLink.id,
        sourceRefs: []
      }
    },
    slotSchemaVersion: 'v1_fixed_8_slots'
  });

  const result = await activateCityPack({
    cityPackId: created.id,
    actor: 'phase666_test',
    traceId: 'trace_phase666_school_guard',
    requestId: 'req_phase666_school_guard'
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'school_link_not_public');

  const audits = listDocs(getDb(), 'audit_logs');
  assert.ok(audits.some((row) => row.action === 'city_pack.activate.blocked' && row.traceId === 'trace_phase666_school_guard'));
});
