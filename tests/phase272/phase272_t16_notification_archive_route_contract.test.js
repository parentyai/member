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

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test('phase272: POST /api/admin/os/notifications/archive archives rows without physical delete', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_archive_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const createdA = await notificationsRepo.createNotification({
    title: 'Archive Target A',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_archive_a',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'GENERAL',
    status: 'draft'
  });
  await notificationsRepo.createNotification({
    title: 'Archive Target B',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_archive_b',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'STEP',
    status: 'draft'
  });

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const headers = {
    'x-admin-token': 'phase272_archive_admin_token',
    'x-actor': 'phase272_archive_test',
    'x-trace-id': 'trace_phase272_archive_contract',
    'content-type': 'application/json; charset=utf-8'
  };

  const archiveRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/os/notifications/archive',
    headers,
    body: JSON.stringify({
      notificationIds: [createdA.id],
      reason: 'phase272_contract'
    })
  });
  assert.strictEqual(archiveRes.status, 200);
  const archiveBody = JSON.parse(archiveRes.body);
  assert.strictEqual(archiveBody.ok, true);
  assert.strictEqual(archiveBody.archivedCount, 1);

  const defaultList = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=20',
    headers: {
      'x-admin-token': 'phase272_archive_admin_token',
      'x-actor': 'phase272_archive_test',
      'x-trace-id': 'trace_phase272_archive_default_list'
    }
  });
  assert.strictEqual(defaultList.status, 200);
  const defaultBody = JSON.parse(defaultList.body);
  assert.ok(Array.isArray(defaultBody.items));
  assert.ok(!defaultBody.items.some((row) => row.id === createdA.id));

  const includeArchived = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=20&includeArchived=1',
    headers: {
      'x-admin-token': 'phase272_archive_admin_token',
      'x-actor': 'phase272_archive_test',
      'x-trace-id': 'trace_phase272_archive_include_list'
    }
  });
  assert.strictEqual(includeArchived.status, 200);
  const includeBody = JSON.parse(includeArchived.body);
  const archivedRow = includeBody.items.find((row) => row.id === createdA.id);
  assert.ok(archivedRow);
  assert.strictEqual(archivedRow.archiveReason, 'phase272_contract');
  assert.strictEqual(archivedRow.archivedBy, 'phase272_archive_test');
});
