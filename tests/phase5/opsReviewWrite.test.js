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

const usersRepo = require('../../src/repos/firestore/usersRepo');
const { handleUserReview } = require('../../src/routes/phase5AdminUsers');

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

test('ops review write: updates user opsReview fields', async () => {
  await usersRepo.createUser('U1', { scenarioKey: 'A', stepKey: '3mo' });
  const res = createRes();
  const req = { headers: { 'x-actor': 'operator-1' } };

  await handleUserReview(req, res, JSON.stringify({ lineUserId: 'U1' }));
  assert.strictEqual(res.statusCode, 200);

  const user = await usersRepo.getUser('U1');
  assert.strictEqual(user.opsReviewLastReviewedBy, 'operator-1');
  assert.strictEqual(user.opsReviewLastReviewedAt, '2026-01-01T00:00:00Z');
});
