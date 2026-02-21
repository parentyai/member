'use strict';

const assert = require('assert');
const http = require('http');
const { readFileSync } = require('fs');
const { test } = require('node:test');

const { resolvePathProtection } = require('../../src/domain/security/protectionMatrix');
const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');

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

test('phase307: protection matrix resolves expected auth classes', () => {
  assert.deepStrictEqual(resolvePathProtection('/api/admin/trace'), { auth: 'adminToken' });
  assert.deepStrictEqual(resolvePathProtection('/admin/app'), { auth: 'adminToken' });
  assert.deepStrictEqual(resolvePathProtection('/internal/jobs/retention-dry-run'), { auth: 'internalToken' });
  assert.deepStrictEqual(resolvePathProtection('/api/phase24/ops-state'), { auth: 'adminToken' });
  assert.strictEqual(resolvePathProtection('/api/public/healthz'), null);
});

test('phase307: index.js routes protection via resolvePathProtection reference', () => {
  const source = readFileSync('src/index.js', 'utf8');
  assert.ok(source.includes("require('./domain/security/protectionMatrix')"));
  assert.ok(source.includes('resolvePathProtection(pathname)'));
});

test('phase307: internal retention dry-run route requires only internal token (not admin token)', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevInternalToken = process.env.CITY_PACK_JOB_TOKEN;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  if (prevAdminToken !== undefined) delete process.env.ADMIN_OS_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase307_internal_token';

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
    if (prevInternalToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternalToken;
  });

  const unauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ collections: ['events'] })
  });
  assert.strictEqual(unauthorized.status, 401);

  const ok = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase307_internal_token',
      'x-trace-id': 'trace_phase307_protection'
    },
    body: JSON.stringify({ collections: ['events'] })
  });
  assert.strictEqual(ok.status, 200);
  const payload = JSON.parse(ok.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.dryRun, true);
});
