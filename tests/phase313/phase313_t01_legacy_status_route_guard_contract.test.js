'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');

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

test('phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase313_admin_token';
  setDbForTest(createDbStub());

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const unauthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/legacy-status'
  });
  assert.strictEqual(unauthorized.status, 401);

  const ok = await request({
    port,
    method: 'GET',
    path: '/api/admin/legacy-status',
    headers: {
      'x-admin-token': 'phase313_admin_token',
      'x-actor': 'phase313_test',
      'x-trace-id': 'trace_phase313_legacy'
    }
  });
  assert.strictEqual(ok.status, 200, ok.body);
  const payload = JSON.parse(ok.body);
  assert.strictEqual(payload.ok, true);
  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.some((item) => item.path === '/admin/review'));
  assert.ok(payload.summary && Number.isFinite(Number(payload.summary.total)));
});
