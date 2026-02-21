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

test('phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevSnapshotMode = process.env.OPS_SNAPSHOT_MODE;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase312_admin_token';
  process.env.OPS_SNAPSHOT_MODE = 'require';

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
    if (prevSnapshotMode === undefined) delete process.env.OPS_SNAPSHOT_MODE;
    else process.env.OPS_SNAPSHOT_MODE = prevSnapshotMode;
  });

  const res = await request({
    port,
    method: 'GET',
    path: '/api/admin/os/dashboard/kpi?windowMonths=1',
    headers: {
      'x-admin-token': 'phase312_admin_token',
      'x-actor': 'phase312_test',
      'x-trace-id': 'trace_phase312_dashboard'
    }
  });

  assert.strictEqual(res.status, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.dataSource, 'not_available');
  assert.strictEqual(payload.source, 'not_available');
  assert.strictEqual(payload.asOf, null);
  assert.strictEqual(payload.kpis.registrations.available, false);
  assert.strictEqual(payload.kpis.cityPackUsage.available, false);
});
