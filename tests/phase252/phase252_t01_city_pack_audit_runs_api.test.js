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
const sourceAuditRunsRepo = require('../../src/repos/firestore/sourceAuditRunsRepo');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('phase252: city pack audit runs API requires token and returns summary/status', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;

  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase252_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceAuditRunsRepo.saveRun('run_ok_001', {
    runId: 'run_ok_001',
    mode: 'scheduled',
    startedAt: '2026-02-18T00:00:00.000Z',
    endedAt: '2026-02-18T00:01:00.000Z',
    processed: 3,
    succeeded: 3,
    failed: 0,
    traceId: 'trace_ok_001'
  });
  await sourceAuditRunsRepo.saveRun('run_warn_001', {
    runId: 'run_warn_001',
    mode: 'canary',
    startedAt: '2026-02-18T03:00:00.000Z',
    endedAt: '2026-02-18T03:02:00.000Z',
    processed: 5,
    succeeded: 4,
    failed: 1,
    traceId: 'trace_warn_001'
  });
  await sourceAuditRunsRepo.saveRun('run_running_001', {
    runId: 'run_running_001',
    mode: 'scheduled',
    startedAt: '2026-02-18T02:00:00.000Z',
    endedAt: null,
    processed: 0,
    succeeded: 0,
    failed: 0,
    traceId: 'trace_running_001'
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
    path: '/api/admin/city-pack-source-audit/runs'
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-source-audit/runs?limit=10',
    headers: {
      'x-admin-token': 'phase252_admin_token',
      'x-actor': 'phase252_test'
    }
  });
  assert.strictEqual(withToken.status, 200);

  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.strictEqual(body.items.length, 3);
  assert.deepStrictEqual(
    body.items.map((item) => item.runId),
    ['run_warn_001', 'run_running_001', 'run_ok_001']
  );
  assert.deepStrictEqual(
    body.items.map((item) => item.status),
    ['WARN', 'RUNNING', 'OK']
  );
  assert.strictEqual(body.summary.total, 3);
  assert.strictEqual(body.summary.warn, 1);
  assert.strictEqual(body.summary.running, 1);
  assert.strictEqual(body.summary.ok, 1);
});

