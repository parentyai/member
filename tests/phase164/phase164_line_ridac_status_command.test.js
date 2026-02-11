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
  process.env.SERVICE_MODE = 'webhook'; // avoid welcome message side effects in tests
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
    replyToken: replyToken || 'r1',
    source: { userId },
    message: { type: 'text', text }
  };
}

function signBody(secret, body) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

test('phase164: LINE command "会員ID 確認" replies with status (last4 only)', async () => {
  const secret = 'test-secret';
  process.env.LINE_CHANNEL_SECRET = secret;
  process.env.ENV_NAME = 'test';

  // Declared user (last4 only)
  await usersRepo.createUser('U1', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null,
    memberCardAsset: null,
    ridacMembershipIdHash: 'HASH1',
    ridacMembershipIdLast4: '3456',
    ridacMembershipDeclaredAt: '2026-02-10T01:02:03.000Z',
    ridacMembershipDeclaredBy: 'user'
  });

  // Unlinked user (no last4, has unlinkedAt)
  await usersRepo.createUser('U2', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null,
    memberCardAsset: null,
    ridacMembershipIdHash: null,
    ridacMembershipIdLast4: null,
    ridacMembershipUnlinkedAt: '2026-02-10T02:03:04.000Z',
    ridacMembershipUnlinkedBy: 'ops'
  });

  // None user
  await usersRepo.createUser('U3', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null,
    memberCardAsset: null,
    ridacMembershipIdHash: null,
    ridacMembershipIdLast4: null
  });

  const replies = [];
  const payload = {
    events: [
      makeEvent({ userId: 'U1', text: '会員ID 確認', replyToken: 'rt1' }),
      makeEvent({ userId: 'U2', text: '会員ID 確認', replyToken: 'rt2' }),
      makeEvent({ userId: 'U3', text: '会員ID 確認', replyToken: 'rt3' })
    ]
  };
  const body = JSON.stringify(payload);
  const signature = signBody(secret, body);

  const result = await handleLineWebhook({
    signature,
    body,
    requestId: 'req-status',
    allowWelcome: false,
    logger: () => {},
    replyFn: async (replyToken, message) => {
      replies.push({ replyToken, message });
    },
    // prevent external push side effects
    pushFn: async () => {}
  });

  assert.strictEqual(result.status, 200);
  assert.strictEqual(replies.length, 3);

  const r1 = replies.find((r) => r.replyToken === 'rt1');
  const r2 = replies.find((r) => r.replyToken === 'rt2');
  const r3 = replies.find((r) => r.replyToken === 'rt3');

  assert.ok(r1 && r1.message && typeof r1.message.text === 'string');
  assert.ok(r1.message.text.includes('末尾: 3456'));
  assert.ok(r1.message.text.includes('会員ID 00-0000'));
  assert.ok(!r1.message.text.includes('HASH1'));

  assert.ok(r2 && r2.message && typeof r2.message.text === 'string');
  assert.ok(r2.message.text.includes('解除済み'));
  assert.ok(r2.message.text.includes('会員ID 00-0000'));

  assert.ok(r3 && r3.message && typeof r3.message.text === 'string');
  assert.ok(r3.message.text.includes('未登録'));
  assert.ok(r3.message.text.includes('会員ID 00-0000'));
});
