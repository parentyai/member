'use strict';

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function signLine(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

function httpRequest({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events)', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevSecret = process.env.LINE_CHANNEL_SECRET;

  process.env.SERVICE_MODE = 'webhook';
  process.env.LINE_CHANNEL_SECRET = 'test_secret';
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = prevSecret;
  });

  const adminRes = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/ops',
    headers: {}
  });
  assert.strictEqual(adminRes.status, 404);

  const body = JSON.stringify({
    destination: 'dummy',
    events: [
      {
        type: 'follow',
        timestamp: 1700000000000,
        source: { type: 'user', userId: 'U1' }
      }
    ]
  });
  const sig = signLine(body, process.env.LINE_CHANNEL_SECRET);
  const webhookRes = await httpRequest({
    port,
    method: 'POST',
    path: '/webhook/line',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-line-signature': sig
    },
    body
  });

  assert.strictEqual(webhookRes.status, 200);
  assert.strictEqual(webhookRes.body, 'ok');

  const eventsState = db._state.collections.events;
  assert.ok(eventsState, 'events collection exists');
  const docs = Object.values(eventsState.docs).map((doc) => doc.data);
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].lineUserId, 'U1');
  assert.strictEqual(docs[0].type, 'line_webhook.follow');
});

test('phase125: logLineWebhookEvents writes minimal schema (type + ref)', async () => {
  const { logLineWebhookEvents } = require('../../src/usecases/line/logLineWebhookEvents');

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const result = await logLineWebhookEvents({
      requestId: 'r1',
      payload: {
        events: [
          {
            type: 'message',
            timestamp: 1700000000123,
            source: { type: 'user', userId: 'U2' },
            message: { id: 'm1', type: 'text', text: 'hello' }
          }
        ]
      }
    });

    assert.deepEqual(result, { ok: true, appended: 1, skipped: 0 });

    const eventsState = db._state.collections.events;
    const docs = Object.values(eventsState.docs).map((doc) => doc.data);
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].lineUserId, 'U2');
    assert.strictEqual(docs[0].type, 'line_webhook.message');
    assert.strictEqual(docs[0].ref.requestId, 'r1');
    assert.strictEqual(docs[0].ref.messageId, 'm1');
    assert.strictEqual(docs[0].ref.messageType, 'text');
    assert.strictEqual(docs[0].ref.timestampMs, 1700000000123);
    assert.strictEqual(docs[0].createdAt, 'SERVER_TIMESTAMP');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

