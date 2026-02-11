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

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
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
  const last = token.slice(-1);
  const replacement = last === 'A' ? 'B' : 'A';
  return `${token.slice(0, -1)}${replacement}`;
}

test('security: delivery recovery execute requires valid confirmToken and seals delivery', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await deliveriesRepo.createDeliveryWithId('d_recovery_1', {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: false,
    state: 'reserved',
    sentAt: null
  });

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
    if (prevConfirmSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevConfirmSecret;
  });

  const commonHeaders = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_RECOVERY_1',
    'content-type': 'application/json; charset=utf-8'
  };

  const status = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/delivery-recovery/status?deliveryId=d_recovery_1',
    headers: commonHeaders
  });
  assert.strictEqual(status.status, 200);
  const statusJson = JSON.parse(status.body);
  assert.strictEqual(statusJson.ok, true);
  assert.strictEqual(statusJson.delivery.sealed, false);

  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-recovery/plan',
    headers: commonHeaders,
    body: JSON.stringify({ deliveryId: 'd_recovery_1', sealedReason: 'manual_recovery' })
  });
  assert.strictEqual(planRes.status, 200);
  const plan = JSON.parse(planRes.body);
  assert.strictEqual(plan.ok, true);
  assert.ok(plan.planHash);
  assert.ok(plan.confirmToken);

  const missing = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-recovery/execute',
    headers: commonHeaders,
    body: JSON.stringify({ deliveryId: 'd_recovery_1', sealedReason: 'manual_recovery' })
  });
  assert.strictEqual(missing.status, 400);

  const bad = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-recovery/execute',
    headers: commonHeaders,
    body: JSON.stringify({
      deliveryId: 'd_recovery_1',
      sealedReason: 'manual_recovery',
      planHash: plan.planHash,
      confirmToken: tamperToken(plan.confirmToken)
    })
  });
  assert.strictEqual(bad.status, 409);
  const badJson = JSON.parse(bad.body);
  assert.strictEqual(badJson.reason, 'confirm_token_mismatch');

  const okSet = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-recovery/execute',
    headers: commonHeaders,
    body: JSON.stringify({
      deliveryId: 'd_recovery_1',
      sealedReason: 'manual_recovery',
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    })
  });
  assert.strictEqual(okSet.status, 200);
  const okJson = JSON.parse(okSet.body);
  assert.strictEqual(okJson.ok, true);
  assert.strictEqual(okJson.delivery.sealed, true);

  const delivery = await deliveriesRepo.getDelivery('d_recovery_1');
  assert.strictEqual(delivery.sealed, true);
  assert.strictEqual(delivery.sealedReason, 'manual_recovery');

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_RECOVERY_1', 50);
  assert.ok(audits.some((entry) => entry.action === 'delivery_recovery.execute'
    && entry.payloadSummary
    && entry.payloadSummary.ok === false));
});
