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

test('phase272: POST /api/admin/os/notifications/seed/archive archives seeded notifications without deleting data', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_seed_archive_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const seededA = await notificationsRepo.createNotification({
    title: 'Seeded A',
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
    seedRunId: 'run_seed_archive'
  });
  const seededB = await notificationsRepo.createNotification({
    title: 'Seeded B',
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
    seedRunId: 'run_seed_archive'
  });
  await notificationsRepo.createNotification({
    title: 'Non seeded',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'seed_link_c',
    scenarioKey: 'C',
    stepKey: '3mo',
    trigger: 'manual',
    order: 1,
    target: { limit: 30 },
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

  const response = await request({
    port,
    method: 'POST',
    path: '/api/admin/os/notifications/seed/archive',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase272_seed_archive_admin_token',
      'x-actor': 'phase272_seed_archive_test',
      'x-trace-id': 'trace_phase272_seed_archive'
    },
    body: JSON.stringify({
      seedTag: 'dummy',
      seedRunId: 'run_seed_archive',
      reason: 'contract_test'
    })
  });
  assert.strictEqual(response.status, 200);
  const parsed = JSON.parse(response.body);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.seedTag, 'dummy');
  assert.strictEqual(parsed.seedRunId, 'run_seed_archive');
  assert.strictEqual(parsed.archivedCount, 2);

  const seededAfterA = await notificationsRepo.getNotification(seededA.id);
  const seededAfterB = await notificationsRepo.getNotification(seededB.id);
  assert.ok(seededAfterA.seedArchivedAt);
  assert.ok(seededAfterB.seedArchivedAt);
  assert.strictEqual(seededAfterA.seedArchivedBy, 'phase272_seed_archive_test');
  assert.strictEqual(seededAfterB.seedArchiveReason, 'contract_test');
});
