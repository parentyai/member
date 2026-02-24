'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleLineWebhook } = require('../../src/routes/webhookLine');

const SECRET = 'phase653_line_secret';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

function webhookOptions(events, replies) {
  const body = JSON.stringify({ events });
  return {
    body,
    signature: signBody(body),
    requestId: 'phase653_webhook',
    logger: () => {},
    sendWelcomeFn: async () => {},
    pushFn: async () => {},
    replyFn: async (replyToken, message) => {
      replies.push({ replyToken, message });
    }
  };
}

test('phase653: webhook journey command/postback persists profile, schedule, and todo items', async () => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const replies1 = [];
    const commandEvent = {
      type: 'message',
      replyToken: 'rt_journey_1',
      source: { userId: 'U_JOURNEY_1' },
      message: { type: 'text', text: '属性:夫婦' }
    };
    const commandResult = await handleLineWebhook(webhookOptions([commandEvent], replies1));
    assert.equal(commandResult.status, 200);
    assert.equal(replies1.length, 1);
    assert.match(replies1[0].message.text, /属性を「夫婦」/);

    const profileDoc = db._state.collections.user_journey_profiles.docs.U_JOURNEY_1;
    assert.ok(profileDoc, 'user_journey_profiles should be saved');
    assert.equal(profileDoc.data.householdType, 'couple');
    assert.equal(profileDoc.data.scenarioKeyMirror, 'B');

    const replies2 = [];
    const postbackEvent = {
      type: 'postback',
      replyToken: 'rt_journey_2',
      source: { userId: 'U_JOURNEY_1' },
      postback: { data: 'action=set_departure_date&value=2026-04-01' }
    };
    const postbackResult = await handleLineWebhook(webhookOptions([postbackEvent], replies2));
    assert.equal(postbackResult.status, 200);
    assert.equal(replies2.length, 1);
    assert.match(replies2[0].message.text, /渡航日を 2026-04-01 に更新/);

    const scheduleDoc = db._state.collections.user_journey_schedules.docs.U_JOURNEY_1;
    assert.ok(scheduleDoc, 'user_journey_schedules should be saved');
    assert.equal(scheduleDoc.data.departureDate, '2026-04-01');

    const todoDocs = Object.values((db._state.collections.journey_todo_items || { docs: {} }).docs || {});
    assert.equal(todoDocs.length, 4, 'departure schedule + couple household should generate four todos');
    todoDocs.forEach((doc) => {
      assert.equal(doc.data.lineUserId, 'U_JOURNEY_1');
      assert.equal(doc.data.status, 'open');
    });
  } finally {
    delete process.env.LINE_CHANNEL_SECRET;
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
