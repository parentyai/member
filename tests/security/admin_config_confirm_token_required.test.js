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

const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

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

function tamperToken(token) {
  // Flip one character without changing length so base64url decoding cannot
  // accidentally ignore the change.
  const last = token.slice(-1);
  const replacement = last === 'A' ? 'B' : 'A';
  return `${token.slice(0, -1)}${replacement}`;
}

test('security: system config set requires valid confirmToken and writes audit on mismatch', async (t) => {
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

  const commonHeaders = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_CFG_1',
    'content-type': 'application/json; charset=utf-8'
  };

  // Missing planHash/confirmToken.
  const missing = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/set',
    headers: commonHeaders,
    body: JSON.stringify({ servicePhase: null, notificationPreset: null })
  });
  assert.strictEqual(missing.status, 400);

  // Plan.
  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: commonHeaders,
    body: JSON.stringify({ servicePhase: 2, notificationPreset: 'B' })
  });
  assert.strictEqual(planRes.status, 200);
  const plan = JSON.parse(planRes.body);
  assert.strictEqual(plan.ok, true);
  assert.ok(plan.planHash);
  assert.ok(plan.confirmToken);

  // Set with tampered token.
  const bad = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/set',
    headers: commonHeaders,
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      planHash: plan.planHash,
      confirmToken: tamperToken(plan.confirmToken)
    })
  });
  assert.strictEqual(bad.status, 409);
  const badJson = JSON.parse(bad.body);
  assert.strictEqual(badJson.reason, 'confirm_token_mismatch');

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_CFG_1', 50);
  assert.ok(audits.some((a) => a.action === 'system_config.set' && a.payloadSummary && a.payloadSummary.ok === false));
});
