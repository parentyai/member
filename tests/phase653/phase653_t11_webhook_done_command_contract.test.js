'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('crypto');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleLineWebhook } = require('../../src/routes/webhookLine');
const { listEventsByUser } = require('../../src/repos/firestore/eventsRepo');
const usersRepo = require('../../src/repos/firestore/usersRepo');

const SECRET = 'phase653_done_secret';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

function makeEvent({ userId, text, replyToken }) {
  return {
    type: 'message',
    replyToken: replyToken || 'rt-done',
    source: { userId },
    message: { type: 'text', text }
  };
}

test('phase653: webhook done command normalizes action key with underscores and records journey event', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  process.env.SERVICE_MODE = 'webhook';
  process.env.LINE_CHANNEL_SECRET = SECRET;

  try {
    const replies = [];
    await usersRepo.createUser('U_DONE_01', {
      createdAt: '2026-02-20T00:00:00.000Z',
      scenarioKey: 'A',
      stepKey: 'THREE_MONTHS',
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'austin_tx'
    });
    const payload = {
      events: [
        makeEvent({ userId: 'U_DONE_01', text: '完了: Permit Renewal', replyToken: 'rt-done-01' })
      ]
    };
    const body = JSON.stringify(payload);
    const result = await handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: 'phase653-done',
      logger: () => {},
      allowWelcome: false,
      replyFn: async (replyToken, message) => {
        replies.push({ replyToken, message });
      },
      pushFn: async () => {}
    });

    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].message.text.includes('permit_renewal'));

    const events = await listEventsByUser('U_DONE_01', 10);
    const completed = events.find((item) => item.type === 'next_action_completed');
    assert.ok(completed, 'next_action_completed event should be recorded');
    assert.equal(Array.isArray(completed.nextActions), true);
    assert.equal(completed.nextActions[0].key, 'permit_renewal');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    delete process.env.SERVICE_MODE;
    delete process.env.LINE_CHANNEL_SECRET;
  }
});
