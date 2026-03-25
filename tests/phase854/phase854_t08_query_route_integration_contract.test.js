'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
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

test('phase854: quality patrol admin pane reuses the existing query route contract', async (t) => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase854_admin_token';
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

  assert.ok(js.includes('/api/admin/quality-patrol?'));
  const ok = await request({
    port,
    method: 'GET',
    path: '/api/admin/quality-patrol?mode=latest&audience=operator',
    headers: {
      'x-admin-token': 'phase854_admin_token',
      'x-actor': 'phase854_test',
      'x-trace-id': 'trace_phase854_query'
    }
  });
  assert.equal(ok.status, 200, ok.body);
  const payload = JSON.parse(ok.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.queryVersion, 'quality_patrol_query_v1');
  assert.ok(payload.evidenceAvailability);
  assert.equal(typeof payload.evidenceAvailability.status, 'string');
});
