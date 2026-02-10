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

const { ensureUserFromWebhook } = require('../../src/usecases/users/ensureUser');
const { declareRidacMembershipIdFromLine } = require('../../src/usecases/users/declareRidacMembershipIdFromLine');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('security: ridac membership id is not stored in plaintext', async () => {
  await ensureUserFromWebhook('U1');
  const result = await declareRidacMembershipIdFromLine({
    lineUserId: 'U1',
    text: '会員ID 00-0000',
    requestId: 'req1'
  });
  assert.strictEqual(result.ok, true);

  const db = getDb();
  const stateJson = JSON.stringify(db && db._state ? db._state : {});
  assert.ok(!stateJson.includes('00-0000'), 'plaintext ridac membership id must not be stored');
});
