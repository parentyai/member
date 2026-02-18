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
const usersRepo = require('../../src/repos/firestore/usersRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');

function httpRequest({ port, method, path, headers }) {
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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase241: notification deliveries API supports memberNumber search and vendor fallback', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

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

  await usersRepo.createUser('U1', { memberNumber: 'M-001' });
  await usersRepo.createUser('U2', { memberNumber: 'M-001' });

  const linkA = await linkRegistryRepo.createLink({
    title: 'VendorA',
    url: 'https://vendor-a.example/path',
    vendorKey: 'vendor_a',
    vendorLabel: 'Vendor A'
  });
  const linkB = await linkRegistryRepo.createLink({
    title: 'VendorB',
    url: 'https://fallback.example/path'
  });

  const n1 = await notificationsRepo.createNotification({
    title: 'N1',
    body: 'Body1',
    ctaText: 'Go',
    linkRegistryId: linkA.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true },
    status: 'active'
  });
  const n2 = await notificationsRepo.createNotification({
    title: 'N2',
    body: 'Body2',
    ctaText: 'Go',
    linkRegistryId: linkB.id,
    scenarioKey: 'C',
    stepKey: 'week',
    target: { all: true },
    status: 'active'
  });

  await deliveriesRepo.createDeliveryWithId('d1', {
    notificationId: n1.id,
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: '2026-02-18T00:00:00.000Z',
    deliveredAt: '2026-02-18T00:00:00.000Z'
  });
  await deliveriesRepo.createDeliveryWithId('d2', {
    notificationId: n2.id,
    lineUserId: 'U2',
    delivered: false,
    state: 'error',
    sentAt: '2026-02-18T01:00:00.000Z',
    lastError: 'LINE API error: 500'
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/notification-deliveries?memberNumber=M-001&limit=20',
    headers: { 'x-admin-token': 'test_admin_token', 'x-actor': 'phase241_test' }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.strictEqual(body.query.memberNumber, 'M-001');
  assert.deepStrictEqual(body.query.resolvedLineUserIds.sort(), ['U1', 'U2']);
  assert.strictEqual(body.items.length, 2);
  assert.strictEqual(body.items[0].vendorLabel, 'fallback.example');
  assert.strictEqual(body.items[1].vendorLabel, 'Vendor A');
  assert.ok(body.summary.danger >= 1);
});
