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

test('phase266: draft job creates default targetingRules and slots', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const request = await cityPackRequestsRepo.createRequest({
      lineUserId: 'line_u_266',
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'TX::austin',
      traceId: 'trace_phase266_draft'
    });

    const result = await runCityPackDraftJob({
      requestId: request.id,
      traceId: 'trace_phase266_draft',
      sourceUrls: ['https://example.com/tx/austin']
    });

    assert.strictEqual(result.ok, true);
    const pack = await cityPacksRepo.getCityPack(result.draftCityPackIds[0]);
    assert.ok(pack);
    assert.strictEqual(Array.isArray(pack.slots), true);
    assert.strictEqual(pack.slots.length, 1);
    assert.strictEqual(pack.slots[0].slotId, 'core');
    assert.strictEqual(pack.slots[0].status, 'active');
    assert.strictEqual(Array.isArray(pack.targetingRules), true);
    assert.strictEqual(pack.targetingRules.length, 1);
    assert.strictEqual(pack.targetingRules[0].field, 'regionKey');
    assert.strictEqual(pack.targetingRules[0].value, 'TX::austin');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
