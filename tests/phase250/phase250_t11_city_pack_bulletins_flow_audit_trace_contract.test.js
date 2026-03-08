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
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const cityPackBulletinsRepo = require('../../src/repos/firestore/cityPackBulletinsRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

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
  const routePath = require.resolve('../../src/routes/admin/cityPackBulletins');
  delete require.cache[indexPath];
  delete require.cache[routePath];
  return require('../../src/index').createServer();
}

test('phase250: bulletins approve/reject/send keep state transitions with traceable audit logs', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const sendNotificationModule = require('../../src/usecases/notifications/sendNotification');
  const originalSendNotification = sendNotificationModule.sendNotification;
  sendNotificationModule.sendNotification = async () => ({ deliveredCount: 3 });

  const notification = await notificationsRepo.createNotification({
    title: 'phase250 bulletin notification',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase250_bulletin',
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 1 },
    status: 'active'
  });

  await cityPackBulletinsRepo.createBulletin({
    id: 'cpb_phase250_send',
    cityPackId: 'cp_phase250',
    notificationId: notification.id,
    summary: 'needs send',
    traceId: 'trace_phase250_bulletin_seed'
  });
  await cityPackBulletinsRepo.createBulletin({
    id: 'cpb_phase250_reject',
    cityPackId: 'cp_phase250',
    notificationId: notification.id,
    summary: 'needs reject',
    traceId: 'trace_phase250_bulletin_seed'
  });

  const server = createFreshServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    sendNotificationModule.sendNotification = originalSendNotification;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const approveRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-bulletins/cpb_phase250_send/approve',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_bulletin_test',
      'x-trace-id': 'trace_phase250_bulletin_send'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(approveRes.status, 200);

  const sendRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-bulletins/cpb_phase250_send/send',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_bulletin_test',
      'x-trace-id': 'trace_phase250_bulletin_send'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(sendRes.status, 200);
  const sentBulletin = await cityPackBulletinsRepo.getBulletin('cpb_phase250_send');
  assert.strictEqual(sentBulletin.status, 'sent');
  assert.strictEqual(Number(sentBulletin.deliveredCount) || 0, 3);

  const rejectRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-bulletins/cpb_phase250_reject/reject',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_bulletin_test',
      'x-trace-id': 'trace_phase250_bulletin_reject'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(rejectRes.status, 200);
  const rejectedBulletin = await cityPackBulletinsRepo.getBulletin('cpb_phase250_reject');
  assert.strictEqual(rejectedBulletin.status, 'rejected');

  const sendAudits = await auditLogsRepo.listAuditLogsByTraceId('trace_phase250_bulletin_send', 50);
  assert.ok(sendAudits.some((row) => row.action === 'city_pack.bulletin.approve'));
  assert.ok(sendAudits.some((row) => row.action === 'city_pack.bulletin.send'));
  const rejectAudits = await auditLogsRepo.listAuditLogsByTraceId('trace_phase250_bulletin_reject', 50);
  assert.ok(rejectAudits.some((row) => row.action === 'city_pack.bulletin.reject'));
});

test('phase250: bulletin send returns 207 and keeps approved status on partial send', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const sendNotificationModule = require('../../src/usecases/notifications/sendNotification');
  const originalSendNotification = sendNotificationModule.sendNotification;
  sendNotificationModule.sendNotification = async () => ({
    deliveredCount: 1,
    skippedCount: 0,
    failedCount: 1,
    partialFailure: true,
    status: 'completed_with_failures',
    failureSample: [{ lineUserId: 'U1', stage: 'push_failed', error: 'line api error' }]
  });

  const notification = await notificationsRepo.createNotification({
    title: 'phase250 bulletin partial',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase250_bulletin_partial',
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 1 },
    status: 'active'
  });

  await cityPackBulletinsRepo.createBulletin({
    id: 'cpb_phase250_partial',
    cityPackId: 'cp_phase250',
    notificationId: notification.id,
    summary: 'partial send',
    traceId: 'trace_phase250_bulletin_partial',
    status: 'approved'
  });

  const server = createFreshServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    sendNotificationModule.sendNotification = originalSendNotification;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const sendRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-bulletins/cpb_phase250_partial/send',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_bulletin_test',
      'x-trace-id': 'trace_phase250_bulletin_partial'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(sendRes.status, 207);
  const sendBody = JSON.parse(sendRes.body);
  assert.strictEqual(sendBody.ok, false);
  assert.strictEqual(sendBody.partial, true);
  assert.strictEqual(sendBody.reason, 'send_partial_failure');

  const bulletin = await cityPackBulletinsRepo.getBulletin('cpb_phase250_partial');
  assert.strictEqual(bulletin.status, 'approved');
  assert.strictEqual(Number(bulletin.deliveredCount) || 0, 1);
  assert.strictEqual(bulletin.sendResult && bulletin.sendResult.reason, 'send_partial_failure');
});
