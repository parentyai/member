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
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');
const { runCityPackDraftJob } = require('../../src/usecases/cityPack/runCityPackDraftJob');

test('phase306: draft job writes slotContents + request experience fields', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const request = await cityPackRequestsRepo.createRequest({
      lineUserId: 'line_u_draft_306',
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'TX::austin',
      traceId: 'trace_306_draft'
    });

    const result = await runCityPackDraftJob({
      requestId: request.id,
      traceId: 'trace_306_draft',
      sourceUrls: ['https://example.com/tx/austin']
    });

    assert.strictEqual(result.ok, true);
    const pack = await cityPacksRepo.getCityPack(result.draftCityPackIds[0]);
    assert.ok(pack);
    assert.strictEqual(pack.slotSchemaVersion, 'v1_fixed_8_slots');
    assert.ok(pack.slotContents);
    cityPacksRepo.FIXED_SLOT_KEYS.forEach((slotKey) => {
      assert.ok(pack.slotContents[slotKey], `missing slot content ${slotKey}`);
      assert.strictEqual(typeof pack.slotContents[slotKey].description, 'string');
      assert.strictEqual(typeof pack.slotContents[slotKey].ctaText, 'string');
      assert.strictEqual(typeof pack.slotContents[slotKey].linkRegistryId, 'string');
    });

    const reqAfter = await cityPackRequestsRepo.getRequest(request.id);
    assert.strictEqual(reqAfter.status, 'drafted');
    assert.strictEqual(reqAfter.experienceStage, 'drafted');
    assert.deepStrictEqual(reqAfter.draftLinkRegistryIds, []);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
