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

test('phase222: /api/admin/llm/config/* require x-actor when admin token is provided', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

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
    if (prevSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevSecret;
  });

  const headersNoActor = {
    'x-admin-token': 'test_admin_token',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/config/status',
    headers: headersNoActor
  });
  assert.strictEqual(statusRes.status, 400);
  assert.deepStrictEqual(JSON.parse(statusRes.body), { ok: false, error: 'x-actor required' });

  const planRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/plan',
    headers: headersNoActor,
    body: JSON.stringify({ llmEnabled: true })
  });
  assert.strictEqual(planRes.status, 400);
  assert.deepStrictEqual(JSON.parse(planRes.body), { ok: false, error: 'x-actor required' });

  const setRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/set',
    headers: headersNoActor,
    body: JSON.stringify({ llmEnabled: true, planHash: 'x', confirmToken: 'y' })
  });
  assert.strictEqual(setRes.status, 400);
  assert.deepStrictEqual(JSON.parse(setRes.body), { ok: false, error: 'x-actor required' });
});

