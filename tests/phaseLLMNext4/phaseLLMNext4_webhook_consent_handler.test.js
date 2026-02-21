'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const { handleLineWebhook } = require('../../src/routes/webhookLine');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SECRET = 'test_secret_n4';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

function makeMessageEvent(lineUserId, text, replyToken) {
  return {
    type: 'message',
    replyToken: replyToken || 'rt-001',
    source: { userId: lineUserId },
    message: { type: 'text', text }
  };
}

function makeWebhookOptions(events, replyCollector) {
  const payload = { events };
  const body = JSON.stringify(payload);
  const signature = signBody(body);
  return {
    body,
    signature,
    requestId: 'req-n4',
    logger: () => {},
    replyFn: async (token, msg) => { replyCollector.push({ token, msg }); },
    sendWelcomeFn: async () => {},
    pushFn: async () => {}
  };
}

function setup() {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  process.env.LINE_CHANNEL_SECRET = SECRET;
  return db;
}

function teardown() {
  clearDbForTest();
  clearServerTimestampForTest();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('webhook: "AI同意" command replies with consent confirmation', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH01', 'AI同意', 'rt-001')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].token, 'rt-001');
    assert.ok(replies[0].msg.text.includes('同意'), `Expected consent reply, got: ${replies[0].msg.text}`);
  } finally {
    teardown();
  }
});

test('webhook: "LLM同意" command replies with consent confirmation', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH02', 'LLM同意', 'rt-002')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].msg.text.includes('同意'), `Expected consent reply, got: ${replies[0].msg.text}`);
  } finally {
    teardown();
  }
});

test('webhook: "AI拒否" command replies with revoke confirmation', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH03', 'AI拒否', 'rt-003')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.ok(
      replies[0].msg.text.includes('取り消し') || replies[0].msg.text.includes('拒否') || replies[0].msg.text.includes('同意'),
      `Expected revoke reply, got: ${replies[0].msg.text}`
    );
  } finally {
    teardown();
  }
});

test('webhook: "LLM拒否" command replies with revoke confirmation', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH04', 'LLM拒否', 'rt-004')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
  } finally {
    teardown();
  }
});

test('webhook: consent command does not produce membership error reply', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH05', 'AI同意', 'rt-005')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    const replyText = replies[0].msg.text;
    assert.ok(!replyText.includes('会員ID'), `Should not be membership error, got: ${replyText}`);
  } finally {
    teardown();
  }
});

test('webhook: unrelated text does not trigger consent handler', async () => {
  setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH06', 'こんにちは', 'rt-006')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies));
    assert.equal(result.status, 200);
    const consentReplies = replies.filter(r => r.msg.text && r.msg.text.includes('AI機能'));
    assert.equal(consentReplies.length, 0);
  } finally {
    teardown();
  }
});

test('webhook: consent handler stores consent status in user_consents collection', async () => {
  const db = setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH07', 'AI同意', 'rt-007')];
    await handleLineWebhook(makeWebhookOptions(events, replies));

    const snap = await db.collection('user_consents').doc('U_WH07').get();
    assert.ok(snap.exists, 'user_consents document should be created');
    const data = snap.data();
    assert.equal(data.lineUserId, 'U_WH07');
    assert.equal(data.llmConsentStatus, 'accepted');
  } finally {
    teardown();
  }
});

test('webhook: AI拒否 stores revoked status in user_consents collection', async () => {
  const db = setup();
  try {
    const replies = [];
    const events = [makeMessageEvent('U_WH08', 'AI拒否', 'rt-008')];
    await handleLineWebhook(makeWebhookOptions(events, replies));

    const snap = await db.collection('user_consents').doc('U_WH08').get();
    assert.ok(snap.exists, 'user_consents document should be created');
    const data = snap.data();
    assert.equal(data.llmConsentStatus, 'revoked');
  } finally {
    teardown();
  }
});
