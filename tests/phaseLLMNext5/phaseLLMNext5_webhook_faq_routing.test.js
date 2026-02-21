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
const SECRET = 'test_secret_n5';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

function makeMessageEvent(lineUserId, text, replyToken) {
  return {
    type: 'message',
    replyToken: replyToken || 'rt-n5-001',
    source: { userId: lineUserId },
    message: { type: 'text', text }
  };
}

function makeWebhookOptions(events, replyCollector, overrides) {
  const payload = { events };
  const body = JSON.stringify(payload);
  const signature = signBody(body);
  return Object.assign({
    body,
    signature,
    requestId: 'req-n5',
    logger: () => {},
    replyFn: async (token, msg) => { replyCollector.push({ token, msg }); },
    sendWelcomeFn: async () => {},
    pushFn: async () => {}
  }, overrides || {});
}

// Pre-set user with regionKey so declareCityRegionFromLine returns 'already_set'
// instead of 'prompt_required'. For text that doesn't match /地域|city|state|region/i,
// the 'already_set' branch falls through to the FAQ handler.
async function preseedUserWithRegion(db, lineUserId) {
  await db.collection('users').doc(lineUserId).set({
    lineUserId,
    regionKey: 'tokyo_jp',
    regionCity: 'Tokyo',
    regionState: 'JP',
    createdAt: 'SERVER_TIMESTAMP',
    updatedAt: 'SERVER_TIMESTAMP'
  }, { merge: true });
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

test('webhook: unmatched text routes to FAQ fallback and replies with result', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ01');
    const replies = [];
    // Use a clearly non-geographic question that slips past region handler
    const events = [makeMessageEvent('U_FAQ01', 'サービス内容を教えてください', 'rt-n5-001')];

    const faqCalls = [];
    const answerFaqFn = async (params) => {
      faqCalls.push(params);
      return { ok: true, blocked: false, lineMessage: 'FAQ回答: サービス内容についてのご説明です。' };
    };

    const result = await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(result.status, 200);
    assert.equal(faqCalls.length, 1, `faqCalls: ${faqCalls.length}`);
    assert.equal(faqCalls[0].lineUserId, 'U_FAQ01');
    assert.equal(faqCalls[0].question, 'サービス内容を教えてください');
    assert.equal(faqCalls[0].locale, 'ja');
    assert.equal(replies.length, 1);
    assert.equal(replies[0].msg.text, 'FAQ回答: サービス内容についてのご説明です。');
  } finally {
    teardown();
  }
});

test('webhook: consent not accepted returns consent prompt via FAQ fallback', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ02');
    const replies = [];
    const events = [makeMessageEvent('U_FAQ02', '会費はいくらですか', 'rt-n5-002')];

    const answerFaqFn = async () => ({
      ok: true, blocked: true,
      blockedReason: 'user_consent_not_accepted',
      lineMessage: 'AI機能の利用に同意していません。\n「AI同意」とメッセージを送ると同意できます。'
    });

    const result = await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].msg.text.includes('同意'), `Got: ${replies[0].msg.text}`);
  } finally {
    teardown();
  }
});

test('webhook: FAQ fallback does not override consent commands', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ03');
    const replies = [];
    const faqCalls = [];
    const answerFaqFn = async (params) => {
      faqCalls.push(params);
      return { ok: true, blocked: false, lineMessage: 'FAQ' };
    };
    // "AI同意" handled by consent handler → continue → FAQ NOT called
    const events = [makeMessageEvent('U_FAQ03', 'AI同意', 'rt-n5-003')];
    const result = await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(result.status, 200);
    assert.equal(faqCalls.length, 0, 'FAQ should not be called for consent commands');
    assert.equal(replies.length, 1);
    assert.ok(replies[0].msg.text.includes('同意'), `Got: ${replies[0].msg.text}`);
  } finally {
    teardown();
  }
});

test('webhook: FAQ fallback error is caught gracefully (still returns 200)', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ04');
    const replies = [];
    const events = [makeMessageEvent('U_FAQ04', '質問テスト', 'rt-n5-004')];
    const answerFaqFn = async () => { throw new Error('faq service error'); };
    const result = await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(result.status, 200);
  } finally {
    teardown();
  }
});

test('webhook: FAQ fallback passes locale=ja by default', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ05');
    const replies = [];
    const events = [makeMessageEvent('U_FAQ05', '質問', 'rt-n5-005')];
    let receivedLocale;
    const answerFaqFn = async (params) => {
      receivedLocale = params.locale;
      return { ok: true, blocked: false, lineMessage: '回答' };
    };
    await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(receivedLocale, 'ja');
  } finally {
    teardown();
  }
});

test('webhook: FAQ fallback passes traceId from requestId', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ06');
    const replies = [];
    const events = [makeMessageEvent('U_FAQ06', '質問', 'rt-n5-006')];
    let receivedTraceId;
    const answerFaqFn = async (params) => {
      receivedTraceId = params.traceId;
      return { ok: true, blocked: false, lineMessage: '回答' };
    };
    await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn, requestId: 'req-n5-trace' }));
    assert.equal(receivedTraceId, 'req-n5-trace');
  } finally {
    teardown();
  }
});

test('webhook: FAQ fallback without lineMessage does not reply', async () => {
  const db = setup();
  try {
    await preseedUserWithRegion(db, 'U_FAQ07');
    const replies = [];
    const events = [makeMessageEvent('U_FAQ07', '質問', 'rt-n5-007')];
    // Return result without lineMessage
    const answerFaqFn = async () => ({ ok: true, blocked: false });
    const result = await handleLineWebhook(makeWebhookOptions(events, replies, { answerFaqFn }));
    assert.equal(result.status, 200);
    assert.equal(replies.length, 0, 'No reply when lineMessage is absent');
  } finally {
    teardown();
  }
});
