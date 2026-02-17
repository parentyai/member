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

const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');

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

test('phase234: llm config plan/set supports llmPolicy snapshot and hash verification', async (t) => {
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

  const headers = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_LLM_POLICY_1',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await request({ port, method: 'GET', path: '/api/admin/llm/config/status', headers });
  assert.strictEqual(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.deepStrictEqual(statusJson.llmPolicy, {
    lawfulBasis: 'unspecified',
    consentVerified: false,
    crossBorder: false
  });

  const planRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/plan',
    headers,
    body: JSON.stringify({
      llmEnabled: true,
      llmPolicy: {
        lawfulBasis: 'consent',
        consentVerified: true,
        crossBorder: true
      }
    })
  });
  assert.strictEqual(planRes.status, 200);
  const planJson = JSON.parse(planRes.body);
  assert.strictEqual(planJson.ok, true);
  assert.strictEqual(planJson.llmPolicy.lawfulBasis, 'consent');
  assert.strictEqual(planJson.llmPolicy.consentVerified, true);
  assert.strictEqual(planJson.llmPolicy.crossBorder, true);

  const mismatchSetRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/set',
    headers,
    body: JSON.stringify({
      llmEnabled: true,
      llmPolicy: {
        lawfulBasis: 'consent',
        consentVerified: true,
        crossBorder: false
      },
      planHash: planJson.planHash,
      confirmToken: planJson.confirmToken
    })
  });
  assert.strictEqual(mismatchSetRes.status, 409);
  const mismatchSetJson = JSON.parse(mismatchSetRes.body);
  assert.strictEqual(mismatchSetJson.reason, 'plan_hash_mismatch');

  const okSetRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/set',
    headers,
    body: JSON.stringify({
      llmEnabled: true,
      llmPolicy: planJson.llmPolicy,
      planHash: planJson.planHash,
      confirmToken: planJson.confirmToken
    })
  });
  assert.strictEqual(okSetRes.status, 200);
  const currentPolicy = await systemFlagsRepo.getLlmPolicy();
  assert.deepStrictEqual(currentPolicy, {
    lawfulBasis: 'consent',
    consentVerified: true,
    crossBorder: true
  });
});
