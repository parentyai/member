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

test('phase272: GET /api/admin/os/notifications/list returns rows under admin guard', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await notificationsRepo.createNotification({
    title: 'Phase272 Notification',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase272',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'GENERAL',
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

  const noToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=10'
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=10',
    headers: {
      'x-admin-token': 'phase272_admin_token',
      'x-actor': 'phase272_test',
      'x-trace-id': 'trace_phase272_list'
    }
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.items.length >= 1);
  assert.ok(
    body.items.some((row) => (
      row.title === 'Phase272 Notification'
      && row.notificationType === 'GENERAL'
      && row.trigger === 'manual'
      && row.order === 3
    ))
  );
});

test('phase272: notifications list excludes archived seed rows by default and includes them when includeArchivedSeed=1', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_admin_token_seed';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await notificationsRepo.createNotification({
    title: 'Active Dummy',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase272_active',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'GENERAL',
    status: 'draft',
    seedTag: 'dummy',
    seedRunId: 'run_phase272_seed',
    seededAt: '2026-03-01T00:00:00.000Z'
  });
  await notificationsRepo.createNotification({
    title: 'Archived Dummy',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase272_archived',
    scenarioKey: 'A',
    stepKey: 'week',
    trigger: 'manual',
    order: 3,
    target: { limit: 50 },
    notificationType: 'GENERAL',
    status: 'draft',
    seedTag: 'dummy',
    seedRunId: 'run_phase272_seed',
    seededAt: '2026-03-01T00:00:00.000Z',
    seedArchivedAt: '2026-03-01T00:10:00.000Z',
    seedArchivedBy: 'phase272',
    seedArchiveReason: 'test'
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
    'x-admin-token': 'phase272_admin_token_seed',
    'x-actor': 'phase272_test',
    'x-trace-id': 'trace_phase272_seed_list'
  };

  const defaultList = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=20',
    headers
  });
  assert.strictEqual(defaultList.status, 200);
  const defaultBody = JSON.parse(defaultList.body);
  assert.strictEqual(defaultBody.ok, true);
  assert.ok(Array.isArray(defaultBody.items));
  assert.ok(defaultBody.items.some((row) => row.title === 'Active Dummy'));
  assert.ok(!defaultBody.items.some((row) => row.title === 'Archived Dummy'));

  const includeArchived = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/notifications/list?limit=20&includeArchivedSeed=1',
    headers
  });
  assert.strictEqual(includeArchived.status, 200);
  const includeBody = JSON.parse(includeArchived.body);
  assert.strictEqual(includeBody.ok, true);
  const archivedRow = includeBody.items.find((row) => row.title === 'Archived Dummy');
  assert.ok(archivedRow);
  assert.strictEqual(archivedRow.seedTag, 'dummy');
  assert.strictEqual(archivedRow.seedRunId, 'run_phase272_seed');
  assert.strictEqual(archivedRow.seedArchiveReason, 'test');
});
