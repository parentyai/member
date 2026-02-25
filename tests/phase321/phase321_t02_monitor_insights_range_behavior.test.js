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
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

function httpRequest({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase321_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const link = await linkRegistryRepo.createLink({
    title: 'Vendor',
    url: 'https://vendor.example/path',
    vendorKey: 'vendor',
    vendorLabel: 'Vendor'
  });

  const oldNotification = await notificationsRepo.createNotification({
    title: 'old',
    body: 'old',
    ctaText: 'go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    status: 'active',
    target: { all: true }
  });
  const recentNotification = await notificationsRepo.createNotification({
    title: 'recent',
    body: 'recent',
    ctaText: 'go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: 'week',
    status: 'active',
    target: { all: true }
  });

  await deliveriesRepo.createDeliveryWithId('old_delivery', {
    notificationId: oldNotification.id,
    lineUserId: 'U_old',
    delivered: true,
    state: 'delivered',
    sentAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    clickAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  });
  await deliveriesRepo.createDeliveryWithId('recent_delivery', {
    notificationId: recentNotification.id,
    lineUserId: 'U_recent',
    delivered: true,
    state: 'delivered',
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    clickAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/monitor-insights?windowDays=7&limit=10&readLimit=1000',
    headers: {
      'x-admin-token': 'phase321_admin_token',
      'x-actor': 'phase321_test',
      'x-trace-id': 'trace_phase321_insights'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.ctrTop));
  assert.ok(body.ctrTop.some((row) => row.notificationId === recentNotification.id));
  assert.ok(!body.ctrTop.some((row) => row.notificationId === oldNotification.id));
  assert.ok(typeof body.asOf === 'string' && body.asOf.length > 0);
  const asOfMillis = Date.parse(body.asOf);
  assert.ok(Number.isFinite(asOfMillis));
  const ageMs = Date.now() - asOfMillis;
  assert.ok(ageMs >= 0);
  assert.ok(typeof body.freshnessMinutes === 'number');
  assert.ok(Number.isFinite(body.freshnessMinutes));
  assert.ok(body.freshnessMinutes >= 0);
});

test('phase321: fallbackOnEmpty=false + fallbackMode=block returns not_available metadata', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase321_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/monitor-insights?windowDays=7&fallbackMode=block&fallbackOnEmpty=false&readLimit=10',
    headers: {
      'x-admin-token': 'phase321_admin_token',
      'x-actor': 'phase321_test',
      'x-trace-id': 'trace_phase321_insights_not_available'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.dataSource, 'not_available');
  assert.strictEqual(body.source, 'not_available');
  assert.strictEqual(body.fallbackUsed, false);
  assert.strictEqual(body.fallbackBlocked, true);
  assert.strictEqual(body.asOf, null);
  assert.strictEqual(body.freshnessMinutes, null);
});
