'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');

test('phase373: city_packs persists packClass/language defaults and nationwide policy', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    const createdRegional = await cityPacksRepo.createCityPack({
      id: 'cp_phase373_regional',
      name: 'Austin Default',
      sourceRefs: ['sr_phase373_1']
    });
    const regional = await cityPacksRepo.getCityPack(createdRegional.id);
    assert.strictEqual(regional.packClass, 'regional');
    assert.strictEqual(regional.language, 'ja');
    assert.strictEqual(regional.nationwidePolicy, null);

    const createdNationwide = await cityPacksRepo.createCityPack({
      id: 'cp_phase373_nationwide',
      name: 'Federal JA',
      sourceRefs: ['sr_phase373_2'],
      packClass: 'nationwide',
      language: 'ja'
    });
    const nationwide = await cityPacksRepo.getCityPack(createdNationwide.id);
    assert.strictEqual(nationwide.packClass, 'nationwide');
    assert.strictEqual(nationwide.language, 'ja');
    assert.strictEqual(nationwide.nationwidePolicy, cityPacksRepo.NATIONWIDE_POLICY_FEDERAL_ONLY);

    const filtered = await cityPacksRepo.listCityPacks({ packClass: 'nationwide', language: 'ja', limit: 20 });
    assert.ok(filtered.some((item) => item.id === createdNationwide.id));
    assert.ok(!filtered.some((item) => item.id === createdRegional.id));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
