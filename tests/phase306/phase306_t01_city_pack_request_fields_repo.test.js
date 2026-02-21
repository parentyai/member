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

test('phase306: city_pack_requests persists add-only experience fields', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const created = await cityPackRequestsRepo.createRequest({
      lineUserId: 'line_u_306',
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'TX::austin',
      traceId: 'trace_306_request',
      draftCityPackIds: ['cp_306'],
      draftSourceRefIds: ['sr_306'],
      draftLinkRegistryIds: ['lr_306'],
      experienceStage: 'needs_review',
      lastReviewAt: '2026-02-21T00:00:00.000Z'
    });

    const row = await cityPackRequestsRepo.getRequest(created.id);
    assert.ok(row);
    assert.deepStrictEqual(row.draftLinkRegistryIds, ['lr_306']);
    assert.strictEqual(row.experienceStage, 'needs_review');
    assert.strictEqual(row.lastReviewAt, '2026-02-21T00:00:00.000Z');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
