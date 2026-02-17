'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided)', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/faq/answer',
    headers: {
      'x-admin-token': 'test_admin_token',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ question: '会員番号の確認方法は？', locale: 'ja' })
  });

  // x-actor is optional for this endpoint. Missing x-actor must not fail with 400/x-actor required.
  assert.notStrictEqual(res.status, 400);
  const json = JSON.parse(res.body);
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.httpStatus, 422);
  assert.strictEqual(json.blockedReason, 'llm_disabled');
});

