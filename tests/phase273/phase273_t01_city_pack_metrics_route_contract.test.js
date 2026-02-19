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
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const cityPackMetricsDailyRepo = require('../../src/repos/firestore/cityPackMetricsDailyRepo');

function request({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase273: city-pack-metrics route is admin-guarded and persists daily rows', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase273_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceRefsRepo.createSourceRef({
    id: 'sr_phase273',
    url: 'https://example.com/phase273',
    status: 'active',
    validUntil: '2099-01-01T00:00:00.000Z',
    usedByCityPackIds: ['cp_phase273']
  });

  const created = await notificationsRepo.createNotification({
    title: 'phase273 notification',
    body: 'body',
    ctaText: 'CTA',
    linkRegistryId: 'link_phase273',
    scenarioKey: 'A',
    stepKey: 'week',
    target: { limit: 50 },
    sourceRefs: ['sr_phase273'],
    notificationMeta: { slotId: 'slot_phase273' },
    status: 'active'
  });

  const nowIso = new Date().toISOString();
  await db.collection('notification_deliveries').doc('d_phase273_1').set({
    notificationId: created.id,
    lineUserId: 'U_phase273_1',
    state: 'delivered',
    delivered: true,
    sentAt: nowIso,
    deliveredAt: nowIso,
    clickAt: nowIso
  }, { merge: false });

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
    path: '/api/admin/city-pack-metrics?windowDays=7&limit=20'
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-metrics?windowDays=7&limit=20',
    headers: {
      'x-admin-token': 'phase273_admin_token',
      'x-actor': 'phase273_test',
      'x-trace-id': 'trace_phase273_metrics'
    }
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.items.some((item) => item.cityPackId === 'cp_phase273' && item.slotId === 'slot_phase273'));

  const dateKey = new Date().toISOString().slice(0, 10);
  const rows = await cityPackMetricsDailyRepo.listMetricRows({ dateFrom: dateKey, dateTo: dateKey, limit: 50 });
  assert.ok(rows.some((row) => row.cityPackId === 'cp_phase273' && row.sourceRefId === 'sr_phase273'));
});

