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

test('phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const created = await linkRegistryRepo.createLink({
    label: 'Guide Link',
    url: 'https://example.com/guide',
    lastHealth: { state: 'OK' }
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
    path: `/api/admin/os/link-registry/${created.id}`
  });
  assert.strictEqual(noToken.status, 401);

  const ok = await request({
    port,
    method: 'GET',
    path: `/api/admin/os/link-registry/${created.id}`,
    headers: {
      'x-admin-token': 'phase272_admin_token',
      'x-actor': 'phase272_test',
      'x-trace-id': 'trace_phase272_link'
    }
  });
  assert.strictEqual(ok.status, 200);
  const body = JSON.parse(ok.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.item.id, created.id);
  assert.strictEqual(body.item.label, 'Guide Link');

  const missing = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/link-registry/not_found',
    headers: {
      'x-admin-token': 'phase272_admin_token',
      'x-actor': 'phase272_test'
    }
  });
  assert.strictEqual(missing.status, 404);
});
