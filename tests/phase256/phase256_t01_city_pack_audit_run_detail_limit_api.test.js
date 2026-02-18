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
const sourceEvidenceRepo = require('../../src/repos/firestore/sourceEvidenceRepo');

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

test('phase256: city pack run detail API applies evidence limit query', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase256_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceAuditRunsRepo.saveRun('run_limit_001', {
    runId: 'run_limit_001',
    mode: 'scheduled',
    startedAt: '2026-02-18T02:00:00.000Z',
    endedAt: '2026-02-18T02:01:00.000Z',
    processed: 2,
    succeeded: 2,
    failed: 0,
    traceId: 'trace_limit_001'
  });

  await sourceEvidenceRepo.createEvidence({
    id: 'ev_limit_001',
    sourceRefId: 'sr1',
    checkedAt: '2026-02-18T02:00:20.000Z',
    result: 'ok',
    traceId: 'trace_limit_001',
    screenshotPaths: []
  });
  await sourceEvidenceRepo.createEvidence({
    id: 'ev_limit_002',
    sourceRefId: 'sr2',
    checkedAt: '2026-02-18T02:00:40.000Z',
    result: 'ok',
    traceId: 'trace_limit_001',
    screenshotPaths: []
  });

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const res = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-source-audit/runs/run_limit_001?limit=1',
    headers: {
      'x-admin-token': 'phase256_admin_token',
      'x-actor': 'phase256_test'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.evidenceLimit, 1);
  assert.strictEqual(body.evidences.length, 1);
  assert.strictEqual(body.evidences[0].evidenceId, 'ev_limit_002');
});
