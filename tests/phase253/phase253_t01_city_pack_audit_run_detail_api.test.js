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

test('phase253: city pack run detail API requires token and returns run + evidences', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;

  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase253_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceAuditRunsRepo.saveRun('run_detail_001', {
    runId: 'run_detail_001',
    mode: 'scheduled',
    startedAt: '2026-02-18T01:00:00.000Z',
    endedAt: '2026-02-18T01:01:00.000Z',
    processed: 2,
    succeeded: 1,
    failed: 1,
    failureTop3: ['timeout:1'],
    traceId: 'trace_detail_001'
  });
  await sourceEvidenceRepo.createEvidence({
    id: 'ev_detail_001',
    sourceRefId: 'sr_1',
    checkedAt: '2026-02-18T01:00:10.000Z',
    result: 'timeout',
    statusCode: null,
    finalUrl: 'https://example.com/a',
    traceId: 'trace_detail_001',
    screenshotPaths: []
  });
  await sourceEvidenceRepo.createEvidence({
    id: 'ev_detail_002',
    sourceRefId: 'sr_2',
    checkedAt: '2026-02-18T01:00:20.000Z',
    result: 'ok',
    statusCode: 200,
    finalUrl: 'https://example.com/b',
    traceId: 'trace_detail_001',
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
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const blocked = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-source-audit/runs/run_detail_001'
  });
  assert.strictEqual(blocked.status, 401);

  const ok = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-source-audit/runs/run_detail_001',
    headers: {
      'x-admin-token': 'phase253_admin_token',
      'x-actor': 'phase253_test'
    }
  });
  assert.strictEqual(ok.status, 200);
  const body = JSON.parse(ok.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.run.runId, 'run_detail_001');
  assert.strictEqual(body.run.status, 'WARN');
  assert.strictEqual(body.run.sourceTraceId, 'trace_detail_001');
  assert.ok(Array.isArray(body.evidences));
  assert.strictEqual(body.evidences.length, 2);
  assert.deepStrictEqual(
    body.evidences.map((item) => item.evidenceId),
    ['ev_detail_002', 'ev_detail_001']
  );
});

