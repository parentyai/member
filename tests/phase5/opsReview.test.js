'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const { handleOpsReview } = require('../../src/routes/phase5Review');
const { getOpsState } = require('../../src/repos/firestore/opsStateRepo');

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('ops review: saves lastReviewed fields', async () => {
  const res = createRes();
  await handleOpsReview({ headers: { 'x-actor': 'admin_review', 'x-trace-id': 'trace-test' } }, res, JSON.stringify({ reviewedBy: 'operator-1' }));
  assert.strictEqual(res.statusCode, 200);

  const state = await getOpsState();
  assert.ok(state);
  assert.strictEqual(state.lastReviewedBy, 'operator-1');
  assert.strictEqual(state.lastReviewedAt, '2026-01-01T00:00:00Z');
});
