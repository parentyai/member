'use strict';

const assert = require('node:assert/strict');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createFreshServer() {
  const indexPath = require.resolve('../../src/index');
  const routePath = require.resolve('../../src/routes/admin/notifications');
  delete require.cache[indexPath];
  delete require.cache[routePath];
  return require('../../src/index').createServer();
}

test('phase750: admin notifications send returns 207 + partial payload on partial send', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase750_admin_token';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const sendNotificationModule = require('../../src/usecases/notifications/sendNotification');
  const originalSendNotification = sendNotificationModule.sendNotification;
  sendNotificationModule.sendNotification = async () => ({
    deliveredCount: 1,
    skippedCount: 2,
    failedCount: 1,
    partialFailure: true,
    status: 'completed_with_failures'
  });

  const created = await notificationsRepo.createNotification({
    title: 'phase750 partial',
    body: 'body',
    ctaText: 'open',
    linkRegistryId: 'link_phase750',
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 10 },
    status: 'active'
  });

  const server = createFreshServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    sendNotificationModule.sendNotification = originalSendNotification;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const res = await request({
    port,
    method: 'POST',
    path: `/admin/notifications/${encodeURIComponent(created.id)}/send`,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase750_admin_token',
      'x-actor': 'phase750_admin',
      'x-trace-id': 'trace_phase750_partial'
    },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 207);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.partial, true);
  assert.equal(payload.reason, 'send_partial_failure');
  assert.ok(payload.sendSummary && payload.sendSummary.partialFailure === true);
  assert.equal(Number(payload.deliveredCount), 1);
  assert.equal(Number(payload.failedCount), 1);
});
