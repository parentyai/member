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

test('phase309: retention apply is env/flag guarded and filters by policy', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdmin = process.env.ADMIN_OS_TOKEN;
  const prevInternal = process.env.CITY_PACK_JOB_TOKEN;
  const prevEnvName = process.env.ENV_NAME;
  const prevApplyFlag = process.env.RETENTION_APPLY_ENABLED;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  if (prevAdmin !== undefined) delete process.env.ADMIN_OS_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase309_retention_token';
  process.env.ENV_NAME = 'stg';
  process.env.RETENTION_APPLY_ENABLED = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('events').doc('evt_old').set({ createdAt: '2025-01-01T00:00:00.000Z' }, { merge: false });
  await db.collection('events').doc('evt_new').set({ createdAt: '2026-12-01T00:00:00.000Z' }, { merge: false });
  await db.collection('users').doc('U1').set({ createdAt: '2025-01-01T00:00:00.000Z' }, { merge: false });

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
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
    if (prevApplyFlag === undefined) delete process.env.RETENTION_APPLY_ENABLED;
    else process.env.RETENTION_APPLY_ENABLED = prevApplyFlag;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase309_retention_token',
      'x-trace-id': 'trace_phase309_retention_apply'
    },
    body: JSON.stringify({
      collections: ['events', 'users'],
      cutoffIso: '2026-01-01T00:00:00.000Z',
      limit: 100
    })
  });
  assert.strictEqual(res.status, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.ok(payload.summary.deletedCount >= 1);

  const eventsSnap = await db.collection('events').get();
  const usersSnap = await db.collection('users').get();
  assert.strictEqual(eventsSnap.docs.length, 1);
  assert.strictEqual(usersSnap.docs.length, 1);

  process.env.RETENTION_APPLY_ENABLED = '0';
  const blockedRes = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase309_retention_token',
      'x-trace-id': 'trace_phase309_retention_blocked'
    },
    body: JSON.stringify({
      collections: ['events'],
      cutoffIso: '2026-01-01T00:00:00.000Z'
    })
  });
  assert.strictEqual(blockedRes.status, 409);
});
