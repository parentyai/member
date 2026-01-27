'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const { handleLineWebhook } = require('../../src/routes/webhookLine');

const SECRET = 'test-secret';

function sign(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  delete process.env.LINE_CHANNEL_SECRET;
});

test('webhook: valid signature creates user', async () => {
  const body = JSON.stringify({ events: [{ source: { userId: 'U999' } }] });
  const signature = sign(body);
  const result = await handleLineWebhook({ signature, body, requestId: 'req1', logger: () => {} });
  assert.strictEqual(result.status, 200);

  const user = await usersRepo.getUser('U999');
  assert.ok(user);
  assert.strictEqual(user.id, 'U999');
});

test('webhook: invalid signature rejected', async () => {
  const body = JSON.stringify({ events: [{ source: { userId: 'U888' } }] });
  const result = await handleLineWebhook({ signature: 'invalid', body, requestId: 'req2', logger: () => {} });
  assert.strictEqual(result.status, 401);
  const user = await usersRepo.getUser('U888');
  assert.strictEqual(user, null);
});
