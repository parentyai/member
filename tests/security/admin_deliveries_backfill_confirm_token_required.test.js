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

test('security: delivery backfill execute requires valid confirmToken', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await deliveriesRepo.createDeliveryWithId('d_backfill_1', {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-11T00:00:00.000Z',
    deliveredAt: null
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
    'x-trace-id': 'TRACE_BACKFILL_1',
    'content-type': 'application/json; charset=utf-8'
  };

  const status = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/delivery-backfill/status?limit=10',
    headers: commonHeaders
  });
  assert.strictEqual(status.status, 200);
  const statusJson = JSON.parse(status.body);
  assert.strictEqual(statusJson.ok, true);
  assert.strictEqual(statusJson.summary.fixableCount, 1);

  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/plan',
    headers: commonHeaders,
    body: JSON.stringify({ limit: 10 })
  });
  assert.strictEqual(planRes.status, 200);
  const plan = JSON.parse(planRes.body);
  assert.strictEqual(plan.ok, true);
  assert.ok(plan.planHash);
  assert.ok(plan.confirmToken);

  const missing = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/execute',
    headers: commonHeaders,
    body: JSON.stringify({ limit: 10 })
  });
  assert.strictEqual(missing.status, 400);

  const bad = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/execute',
    headers: commonHeaders,
    body: JSON.stringify({
      limit: 10,
      planHash: plan.planHash,
      confirmToken: tamperToken(plan.confirmToken)
    })
  });
  assert.strictEqual(bad.status, 409);
  const badJson = JSON.parse(bad.body);
  assert.strictEqual(badJson.reason, 'confirm_token_mismatch');

  const okExec = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/execute',
    headers: commonHeaders,
    body: JSON.stringify({
      limit: 10,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    })
  });
  assert.strictEqual(okExec.status, 200);
  const okJson = JSON.parse(okExec.body);
  assert.strictEqual(okJson.ok, true);
  assert.strictEqual(okJson.result.updatedCount, 1);
  assert.strictEqual(okJson.summaryAfter.fixableCount, 0);

  const delivery = await deliveriesRepo.getDelivery('d_backfill_1');
  assert.strictEqual(delivery.deliveredAt, '2026-02-11T00:00:00.000Z');
  assert.strictEqual(delivery.deliveredAtBackfilledBy, 'admin_master');

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_BACKFILL_1', 100);
  assert.ok(audits.some((entry) => entry.action === 'delivery_backfill.execute'
    && entry.payloadSummary
    && entry.payloadSummary.ok === false));
  assert.ok(audits.some((entry) => entry.action === 'delivery_backfill.execute'
    && entry.payloadSummary
    && entry.payloadSummary.ok === true));
});

