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
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');
const { runCityPackDraftJob } = require('../../src/usecases/cityPack/runCityPackDraftJob');


test('phase260: draft job creates source refs and draft city pack', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const request = await cityPackRequestsRepo.createRequest({
      lineUserId: 'line_u_draft',
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'TX::austin',
      traceId: 'trace_draft_260'
    });

    const result = await runCityPackDraftJob({
      requestId: request.id,
      traceId: 'trace_draft_260',
      sourceUrls: ['https://example.com/tx/austin']
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 'drafted');
    assert.strictEqual(result.draftCityPackIds.length, 1);
    assert.strictEqual(result.draftSourceRefIds.length, 1);

    const requestAfter = await cityPackRequestsRepo.getRequest(request.id);
    assert.strictEqual(requestAfter.status, 'drafted');
    assert.strictEqual(requestAfter.draftCityPackIds.length, 1);
    assert.strictEqual(requestAfter.draftSourceRefIds.length, 1);

    const cityPack = await cityPacksRepo.getCityPack(result.draftCityPackIds[0]);
    assert.ok(cityPack);
    assert.strictEqual(cityPack.status, 'draft');
    assert.strictEqual(cityPack.requestId, request.id);

    const sourceRef = await sourceRefsRepo.getSourceRef(result.draftSourceRefIds[0]);
    assert.ok(sourceRef);
    assert.strictEqual(sourceRef.status, 'needs_review');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
