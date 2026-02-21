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

test('phase309: ops snapshot job builds snapshots and dashboard reads snapshot first', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdmin = process.env.ADMIN_OS_TOKEN;
  const prevInternal = process.env.CITY_PACK_JOB_TOKEN;
  const prevSnapshotRead = process.env.OPS_SNAPSHOT_READ_ENABLED;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase309_admin_snapshot';
  process.env.CITY_PACK_JOB_TOKEN = 'phase309_snapshot_token';
  process.env.OPS_SNAPSHOT_READ_ENABLED = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('users').doc('U1').set({ createdAt: '2026-01-01T00:00:00.000Z' }, { merge: false });
  await db.collection('notifications').doc('N1').set({ createdAt: '2026-01-02T00:00:00.000Z' }, { merge: false });
  await db.collection('notification_deliveries').doc('D1').set({ sentAt: '2026-01-03T00:00:00.000Z', delivered: true, clickAt: '2026-01-03T00:10:00.000Z' }, { merge: false });
  await db.collection('events').doc('E1').set({ createdAt: '2026-01-04T00:00:00.000Z', type: 'FAQ_CLICK' }, { merge: false });

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
    if (prevAdmin === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdmin;
    if (prevInternal === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternal;
    if (prevSnapshotRead === undefined) delete process.env.OPS_SNAPSHOT_READ_ENABLED;
    else process.env.OPS_SNAPSHOT_READ_ENABLED = prevSnapshotRead;
  });

  const jobRes = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/ops-snapshot-build',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase309_snapshot_token',
      'x-trace-id': 'trace_phase309_snapshot_job'
    },
    body: JSON.stringify({ dryRun: false, windowMonths: [1], scanLimit: 200 })
  });
  assert.strictEqual(jobRes.status, 200);
  const jobPayload = JSON.parse(jobRes.body);
  assert.strictEqual(jobPayload.ok, true);
  assert.ok(jobPayload.summary.snapshotsBuilt >= 2);

  const snapshotRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/dashboard/kpi?windowMonths=1',
    headers: {
      'x-admin-token': 'phase309_admin_snapshot',
      'x-actor': 'phase309_test_actor',
      'x-trace-id': 'trace_phase309_dashboard'
    }
  });
  assert.strictEqual(snapshotRes.status, 200);
  const snapshotPayload = JSON.parse(snapshotRes.body);
  assert.strictEqual(snapshotPayload.ok, true);
  assert.strictEqual(snapshotPayload.source, 'snapshot');
  assert.ok(snapshotPayload.kpis && typeof snapshotPayload.kpis === 'object');
});
