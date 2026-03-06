'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
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

test('phase716: llm config status/plan/set supports llmConciergeEnabled', async (t) => {
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
    'x-trace-id': 'TRACE_LLM_CFG_716',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await request({ port, method: 'GET', path: '/api/admin/llm/config/status', headers });
  assert.equal(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.equal(statusJson.llmEnabled, false);
  assert.equal(statusJson.llmConciergeEnabled, false);
  assert.equal(statusJson.effectiveConciergeEnabled, false);
  assert.equal(typeof statusJson.envFlag, 'boolean');
  assert.equal(typeof statusJson.systemFlag, 'boolean');
  assert.equal(typeof statusJson.effectiveEnabled, 'boolean');
  assert.equal(typeof statusJson.runtimeState, 'object');
  assert.equal(statusJson.runtimeState.envFlag, statusJson.envFlag);
  assert.equal(statusJson.runtimeState.systemFlag, statusJson.systemFlag);
  assert.equal(statusJson.runtimeState.effectiveEnabled, statusJson.effectiveEnabled);
  assert.equal(statusJson.blockingReason, statusJson.runtimeState.blockingReason);

  const planRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/plan',
    headers,
    body: JSON.stringify({
      llmEnabled: true,
      llmConciergeEnabled: true
    })
  });
  assert.equal(planRes.status, 200);
  const planJson = JSON.parse(planRes.body);
  assert.equal(planJson.ok, true);
  assert.equal(planJson.llmConciergeEnabled, true);
  assert.ok(typeof planJson.planHash === 'string' && planJson.planHash.startsWith('llmcfg_'));
  assert.ok(planJson.confirmToken);

  const setRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/config/set',
    headers,
    body: JSON.stringify({
      llmEnabled: true,
      llmConciergeEnabled: true,
      planHash: planJson.planHash,
      confirmToken: planJson.confirmToken
    })
  });
  assert.equal(setRes.status, 200);

  const stored = await systemFlagsRepo.getLlmConciergeEnabled();
  assert.equal(stored, true);
});
