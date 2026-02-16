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
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const decisionTimelineRepo = require('../../src/repos/firestore/decisionTimelineRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');

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
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase206: GET /api/admin/user-timeline returns deliveries + trace', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
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

  const link = await linkRegistryRepo.createLink({ title: 't', url: 'https://example.com' });
  const notification = await notificationsRepo.createNotification({
    title: 'Title',
    body: 'Body',
    ctaText: 'Go',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true },
    status: 'draft'
  });

  await deliveriesRepo.createDeliveryWithId('d1', {
    notificationId: notification.id,
    lineUserId: 'U1',
    notificationCategory: 'SEQUENCE_GUIDANCE',
    sentAt: 'NOW',
    delivered: true,
    state: 'delivered',
    deliveredAt: 'NOW',
    lastError: null,
    lastErrorAt: null
  });

  await decisionTimelineRepo.appendTimelineEntry({
    lineUserId: 'U1',
    source: 'notification',
    action: 'NOTIFY',
    refId: notification.id,
    notificationId: notification.id,
    traceId: 'TRACE1',
    requestId: 'REQ1',
    actor: 'ops_readonly',
    snapshot: { ok: true }
  });

  await auditLogsRepo.appendAuditLog({
    actor: 'ops_readonly',
    action: 'notifications.test_run',
    entityType: 'notification',
    entityId: notification.id,
    traceId: 'TRACE1',
    requestId: 'REQ1'
  });

  await eventsRepo.createEvent({
    lineUserId: 'U1',
    type: 'click',
    ref: { notificationId: notification.id }
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/user-timeline?lineUserId=U1&limit=10',
    headers: { 'x-admin-token': 'test_admin_token' }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.lineUserId, 'U1');
  assert.ok(Array.isArray(body.deliveries));
  assert.ok(Array.isArray(body.timeline));
  assert.ok(Array.isArray(body.events));
  assert.ok(Array.isArray(body.traceIds));
  assert.ok(body.traceIds.includes('TRACE1'));
  assert.strictEqual(body.deliveries.length, 1);
});
