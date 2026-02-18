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
const { declareCityRegionFromLine } = require('../../src/usecases/cityPack/declareCityRegionFromLine');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');


test('phase260: region declare creates request and user fields', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const result = await declareCityRegionFromLine({
      lineUserId: 'line_u_260',
      text: 'Austin, TX',
      requestId: 'req_260'
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 'declared');
    assert.strictEqual(result.regionKey, 'TX::austin');

    const user = await usersRepo.getUser('line_u_260');
    assert.strictEqual(user.regionCity, 'Austin');
    assert.strictEqual(user.regionState, 'TX');
    assert.strictEqual(user.regionKey, 'TX::austin');

    const requests = await cityPackRequestsRepo.listRequests({ limit: 10 });
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].status, 'queued');
    assert.strictEqual(requests[0].regionKey, 'TX::austin');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
