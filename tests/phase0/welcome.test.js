'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('./firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { sendWelcomeMessage, WELCOME_TEXT } = require('../../src/usecases/notifications/sendWelcomeMessage');
const { handleLineWebhook } = require('../../src/routes/webhookLine');

const SECRET = 'welcome-secret';

function sign(body) {
  return require('crypto').createHmac('sha256', SECRET).update(body).digest('base64');
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

test('sendWelcomeMessage: sends once and records delivery', async () => {
  let pushCount = 0;
  let lastText = '';
  const pushFn = async (lineUserId, message) => {
    pushCount += 1;
    lastText = message.text;
    return { status: 200 };
  };

  const first = await sendWelcomeMessage({ lineUserId: 'U1', pushFn, sentAt: 'NOW' });
  const second = await sendWelcomeMessage({ lineUserId: 'U1', pushFn, sentAt: 'LATER' });

  assert.strictEqual(first.skipped, false);
  assert.strictEqual(second.skipped, true);
  assert.strictEqual(pushCount, 1);
  assert.strictEqual(lastText, WELCOME_TEXT);

  const deliveries = await deliveriesRepo.listDeliveriesByUser('U1');
  assert.strictEqual(deliveries.length, 1);
  assert.strictEqual(deliveries[0].notificationId, 'welcome');
});

test('webhook: welcome send is invoked for new user', async () => {
  const body = JSON.stringify({ events: [{ source: { userId: 'U2' } }] });
  const signature = sign(body);
  let called = 0;
  const result = await handleLineWebhook({
    signature,
    body,
    requestId: 'req-welcome',
    logger: () => {},
    sendWelcomeFn: async () => {
      called += 1;
      return { skipped: false };
    }
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(called, 1);
});
