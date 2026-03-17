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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function setupEnv() {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';
  return () => {
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
    if (prevConfirmSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevConfirmSecret;
  };
}

async function createTestServer(t) {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  const restoreEnv = setupEnv();
  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });
  return { port };
}

test('phase860: kill switch routes attach outcome and outcome headers', async (t) => {
  const { port } = await createTestServer(t);
  const headers = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_KILL_OUTCOME',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/kill-switch/status',
    headers
  });
  assert.strictEqual(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusJson.outcome.state, 'success');
  assert.strictEqual(statusJson.outcome.reason, 'status_viewed');
  assert.strictEqual(statusJson.outcome.guard.routeKey, 'admin_os_kill_switch');
  assert.strictEqual(statusRes.headers['x-member-outcome-state'], 'success');
  assert.strictEqual(statusRes.headers['x-member-outcome-reason'], 'status_viewed');

  const badSetRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/kill-switch/set',
    headers,
    body: JSON.stringify({ isOn: true })
  });
  assert.strictEqual(badSetRes.status, 400);
  const badSetJson = JSON.parse(badSetRes.body);
  assert.strictEqual(badSetJson.outcome.state, 'error');
  assert.strictEqual(badSetJson.outcome.reason, 'confirm_token_required');
  assert.strictEqual(badSetRes.headers['x-member-outcome-state'], 'error');
  assert.strictEqual(badSetRes.headers['x-member-outcome-reason'], 'confirm_token_required');
});

test('phase860: system config plan/set attach outcome and blocked confirm token mismatch', async (t) => {
  const { port } = await createTestServer(t);
  const headers = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_CFG_OUTCOME',
    'content-type': 'application/json; charset=utf-8'
  };

  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers,
    body: JSON.stringify({ servicePhase: 2, notificationPreset: 'B' })
  });
  assert.strictEqual(planRes.status, 200);
  const planJson = JSON.parse(planRes.body);
  assert.strictEqual(planJson.outcome.state, 'success');
  assert.strictEqual(planJson.outcome.reason, 'planned');
  assert.strictEqual(planJson.outcome.guard.routeKey, 'admin_os_config');
  assert.strictEqual(planRes.headers['x-member-outcome-state'], 'success');
  assert.strictEqual(planRes.headers['x-member-outcome-reason'], 'planned');

  const badSetRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/set',
    headers,
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      planHash: planJson.planHash,
      confirmToken: `${planJson.confirmToken.slice(0, -1)}A`
    })
  });
  assert.strictEqual(badSetRes.status, 409);
  const badSetJson = JSON.parse(badSetRes.body);
  assert.strictEqual(badSetJson.outcome.state, 'blocked');
  assert.strictEqual(badSetJson.outcome.reason, 'confirm_token_mismatch');
  assert.strictEqual(badSetRes.headers['x-member-outcome-state'], 'blocked');
  assert.strictEqual(badSetRes.headers['x-member-outcome-reason'], 'confirm_token_mismatch');
});

test('phase860: automation config status/set attach outcome and plan mismatch is blocked', async (t) => {
  const { port } = await createTestServer(t);
  const headers = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_AUTO_OUTCOME',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/automation-config/status',
    headers
  });
  assert.strictEqual(statusRes.status, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusJson.outcome.state, 'success');
  assert.strictEqual(statusJson.outcome.reason, 'status_viewed');
  assert.strictEqual(statusJson.outcome.guard.routeKey, 'admin_os_automation_config');
  assert.strictEqual(statusRes.headers['x-member-outcome-state'], 'success');

  const badSetRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/automation-config/set',
    headers,
    body: JSON.stringify({
      mode: 'EXECUTE',
      planHash: 'auto_cfg_invalid',
      confirmToken: 'invalid'
    })
  });
  assert.strictEqual(badSetRes.status, 409);
  const badSetJson = JSON.parse(badSetRes.body);
  assert.strictEqual(badSetJson.outcome.state, 'blocked');
  assert.strictEqual(badSetJson.outcome.reason, 'plan_hash_mismatch');
  assert.strictEqual(badSetRes.headers['x-member-outcome-state'], 'blocked');
  assert.strictEqual(badSetRes.headers['x-member-outcome-reason'], 'plan_hash_mismatch');
});
