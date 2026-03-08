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

test('phase716: admin/compat generation routes are kill-switch scoped while config/status stays available', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase716_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true }, { merge: true });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const commonHeaders = {
    'x-admin-token': 'phase716_admin_token',
    'x-actor': 'phase716_test_actor',
    'x-trace-id': 'phase716_killswitch_scope_trace'
  };

  const statusRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/config/status',
    headers: commonHeaders
  });
  assert.equal(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.equal(typeof statusJson.llmEnabled, 'boolean');

  const adminFaqRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/faq/answer',
    headers: Object.assign({}, commonHeaders, { 'content-type': 'application/json; charset=utf-8' }),
    body: JSON.stringify({ question: 'visa update', lineUserId: 'U_PHASE716' })
  });
  assert.equal(adminFaqRes.status, 409);
  const adminFaqBody = JSON.parse(adminFaqRes.body);
  assert.equal(adminFaqBody.error, 'kill switch on');
  assert.equal(adminFaqBody.outcome && adminFaqBody.outcome.state, 'blocked');

  const adminOpsRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/ops-explain?lineUserId=U_PHASE716',
    headers: commonHeaders
  });
  assert.equal(adminOpsRes.status, 409);
  const adminOpsBody = JSON.parse(adminOpsRes.body);
  assert.equal(adminOpsBody.error, 'kill switch on');
  assert.equal(adminOpsBody.outcome && adminOpsBody.outcome.state, 'blocked');

  const adminNextRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/next-actions?lineUserId=U_PHASE716',
    headers: commonHeaders
  });
  assert.equal(adminNextRes.status, 409);
  const adminNextBody = JSON.parse(adminNextRes.body);
  assert.equal(adminNextBody.error, 'kill switch on');
  assert.equal(adminNextBody.outcome && adminNextBody.outcome.state, 'blocked');

  const compatOpsRes = await request({
    port,
    method: 'GET',
    path: '/api/phaseLLM2/ops-explain?lineUserId=U_PHASE716',
    headers: commonHeaders
  });
  assert.equal(compatOpsRes.status, 409);
  assert.equal(JSON.parse(compatOpsRes.body).error, 'kill switch on');

  const compatNextRes = await request({
    port,
    method: 'GET',
    path: '/api/phaseLLM3/ops-next-actions?lineUserId=U_PHASE716',
    headers: commonHeaders
  });
  assert.equal(compatNextRes.status, 409);
  assert.equal(JSON.parse(compatNextRes.body).error, 'kill switch on');

  const compatFaqRes = await request({
    port,
    method: 'POST',
    path: '/api/phaseLLM4/faq/answer',
    headers: Object.assign({}, commonHeaders, { 'content-type': 'application/json; charset=utf-8' }),
    body: JSON.stringify({ question: 'visa update', lineUserId: 'U_PHASE716' })
  });
  assert.equal(compatFaqRes.status, 409);
  assert.equal(JSON.parse(compatFaqRes.body).error, 'kill switch on');
});
