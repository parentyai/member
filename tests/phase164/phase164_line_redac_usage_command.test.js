'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const usersRepo = require('../../src/repos/firestore/usersRepo');
const { handleLineWebhook } = require('../../src/routes/webhookLine');
const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  process.env.SERVICE_MODE = 'webhook';
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  delete process.env.SERVICE_MODE;
  delete process.env.LINE_CHANNEL_SECRET;
});

function makeEvent({ userId, text, replyToken }) {
  return {
    type: 'message',
    replyToken,
    source: { userId },
    message: { type: 'text', text }
  };
}

function signBody(secret, body) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

test('phase164: LINE command prefix without payload replies usage guidance', async () => {
  const secret = 'test-secret';
  process.env.LINE_CHANNEL_SECRET = secret;
  process.env.ENV_NAME = 'test';

  const replies = [];
  const payload = {
    events: [
      makeEvent({ userId: 'U1', text: '会員ID', replyToken: 'rt1' }),
      makeEvent({ userId: 'U2', text: '会員ID ヘルプ', replyToken: 'rt2' })
    ]
  };
  const body = JSON.stringify(payload);
  const signature = signBody(secret, body);

  const result = await handleLineWebhook({
    signature,
    body,
    requestId: 'req-usage',
    allowWelcome: false,
    logger: () => {},
    replyFn: async (replyToken, message) => {
      replies.push({ replyToken, message });
    },
    pushFn: async () => {}
  });

  assert.strictEqual(result.status, 200);
  assert.strictEqual(replies.length, 2);
  for (const reply of replies) {
    assert.ok(reply.message && typeof reply.message.text === 'string');
    assert.ok(reply.message.text.includes('会員ID 00-0000'));
    assert.ok(reply.message.text.includes('会員ID 確認'));
  }

  const u1 = await usersRepo.getUser('U1');
  const u2 = await usersRepo.getUser('U2');
  assert.ok(u1);
  assert.ok(u2);
  assert.strictEqual(u1.redacMembershipIdHash || null, null);
  assert.strictEqual(u2.redacMembershipIdHash || null, null);
});

