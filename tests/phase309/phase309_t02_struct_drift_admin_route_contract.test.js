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

test('phase309: admin struct drift routes require admin token and support list/execute', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdmin = process.env.ADMIN_OS_TOKEN;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase309_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('users').doc('U1').set({ scenario: 'A' }, { merge: false });

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
  });

  const unauthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/struct-drift/backfill-runs'
  });
  assert.strictEqual(unauthorized.status, 401);

  const listRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/struct-drift/backfill-runs?limit=10',
    headers: {
      'x-admin-token': 'phase309_admin_token',
      'x-actor': 'phase309_test_actor',
      'x-trace-id': 'trace_phase309_struct_list'
    }
  });
  assert.strictEqual(listRes.status, 200);
  const listPayload = JSON.parse(listRes.body);
  assert.strictEqual(listPayload.ok, true);
  assert.ok(Array.isArray(listPayload.items));

  const applyWithoutConfirm = await request({
    port,
    method: 'POST',
    path: '/api/admin/struct-drift/backfill',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase309_admin_token',
      'x-actor': 'phase309_test_actor',
      'x-trace-id': 'trace_phase309_struct_apply_ng'
    },
    body: JSON.stringify({ apply: true, scanLimit: 10 })
  });
  assert.strictEqual(applyWithoutConfirm.status, 400);

  const dryRunRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/struct-drift/backfill',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase309_admin_token',
      'x-actor': 'phase309_test_actor',
      'x-trace-id': 'trace_phase309_struct_dry'
    },
    body: JSON.stringify({ dryRun: true, scanLimit: 10 })
  });
  assert.strictEqual(dryRunRes.status, 200);
  const dryRunPayload = JSON.parse(dryRunRes.body);
  assert.strictEqual(dryRunPayload.ok, true);
  assert.strictEqual(dryRunPayload.summary.mode, 'dry-run');
});
