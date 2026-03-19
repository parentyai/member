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
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');

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

test('phase861: delivery backfill routes expose admin outcome contract', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'phase861_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'phase861_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await deliveriesRepo.createDeliveryWithId('phase861_backfill_fixable', {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-03-01T00:00:00.000Z',
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

  const headers = {
    'x-admin-token': 'phase861_admin_token',
    'x-actor': 'phase861_admin',
    'x-trace-id': 'TRACE_PHASE861_BACKFILL',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/delivery-backfill/status?limit=10',
    headers
  });
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusJson.outcome.state, 'success');
  assert.strictEqual(statusJson.outcome.reason, 'status_viewed');
  assert.strictEqual(statusRes.headers['x-member-outcome-state'], 'success');
  assert.strictEqual(statusRes.headers['x-member-outcome-reason'], 'status_viewed');
  assert.strictEqual(statusRes.headers['x-member-outcome-route-type'], 'admin_route');

  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/plan',
    headers,
    body: JSON.stringify({ limit: 10 })
  });
  const planJson = JSON.parse(planRes.body);
  assert.strictEqual(planRes.status, 200);
  assert.strictEqual(planJson.outcome.state, 'success');
  assert.strictEqual(planJson.outcome.reason, 'planned');

  const badRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-backfill/execute',
    headers,
    body: JSON.stringify({
      limit: 10,
      planHash: planJson.planHash,
      confirmToken: tamperToken(planJson.confirmToken)
    })
  });
  const badJson = JSON.parse(badRes.body);
  assert.strictEqual(badRes.status, 409);
  assert.strictEqual(badJson.outcome.state, 'blocked');
  assert.strictEqual(badJson.outcome.reason, 'confirm_token_mismatch');
  assert.strictEqual(badRes.headers['x-member-outcome-state'], 'blocked');
  assert.strictEqual(badRes.headers['x-member-outcome-reason'], 'confirm_token_mismatch');
});

test('phase861: delivery recovery routes expose admin outcome contract', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'phase861_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'phase861_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await deliveriesRepo.createDeliveryWithId('phase861_recovery_reserved', {
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: false,
    state: 'reserved'
  });
  await deliveriesRepo.createDeliveryWithId('phase861_recovery_delivered', {
    notificationId: 'n2',
    lineUserId: 'U2',
    delivered: true,
    state: 'delivered',
    deliveredAt: '2026-03-01T00:00:00.000Z'
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

  const headers = {
    'x-admin-token': 'phase861_admin_token',
    'x-actor': 'phase861_admin',
    'x-trace-id': 'TRACE_PHASE861_RECOVERY',
    'content-type': 'application/json; charset=utf-8'
  };

  const statusRes = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/delivery-recovery/status?deliveryId=phase861_recovery_reserved',
    headers
  });
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusJson.outcome.state, 'success');
  assert.strictEqual(statusJson.outcome.reason, 'status_viewed');

  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/delivery-recovery/plan',
    headers,
    body: JSON.stringify({ deliveryId: 'phase861_recovery_delivered', sealedReason: 'manual' })
  });
  const planJson = JSON.parse(planRes.body);
  assert.strictEqual(planRes.status, 409);
  assert.strictEqual(planJson.outcome.state, 'blocked');
  assert.strictEqual(planJson.outcome.reason, 'already_delivered');
  assert.strictEqual(planRes.headers['x-member-outcome-state'], 'blocked');
  assert.strictEqual(planRes.headers['x-member-outcome-reason'], 'already_delivered');
});

test('phase861: notification seed archive route exposes admin outcome contract', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase861_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await notificationsRepo.createNotification({
    title: 'Seeded Active',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'seed_link_a',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'GENERAL',
    status: 'draft',
    seedTag: 'dummy',
    seedRunId: 'phase861_seed_run'
  });
  await notificationsRepo.createNotification({
    title: 'Seeded Archived',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'seed_link_b',
    scenarioKey: 'B',
    stepKey: '1mo',
    trigger: 'manual',
    order: 2,
    target: { limit: 40 },
    notificationType: 'STEP',
    status: 'draft',
    seedTag: 'dummy',
    seedRunId: 'phase861_seed_run',
    seedArchivedAt: '2026-03-01T00:00:00.000Z',
    seedArchivedBy: 'phase861_setup'
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
  });

  const headers = {
    'x-admin-token': 'phase861_admin_token',
    'x-actor': 'phase861_admin',
    'x-trace-id': 'TRACE_PHASE861_SEED',
    'content-type': 'application/json; charset=utf-8'
  };

  const archiveRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/notifications/seed/archive',
    headers,
    body: JSON.stringify({
      seedTag: 'dummy',
      seedRunId: 'phase861_seed_run',
      reason: 'contract_test'
    })
  });
  const archiveJson = JSON.parse(archiveRes.body);
  assert.strictEqual(archiveRes.status, 200);
  assert.strictEqual(archiveJson.outcome.state, 'partial');
  assert.strictEqual(archiveJson.outcome.reason, 'completed_with_skips');
  assert.strictEqual(archiveRes.headers['x-member-outcome-state'], 'partial');
  assert.strictEqual(archiveRes.headers['x-member-outcome-reason'], 'completed_with_skips');
});
