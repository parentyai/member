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

test('phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevInternal = process.env.CITY_PACK_JOB_TOKEN;
  const prevEnvName = process.env.ENV_NAME;
  const prevApplyFlag = process.env.RETENTION_APPLY_ENABLED;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase314_retention_token';
  process.env.ENV_NAME = 'stg';
  process.env.RETENTION_APPLY_ENABLED = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('events').doc('e001').set({ createdAt: '2025-01-01T00:00:00.000Z' }, { merge: false });

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
    if (prevInternal === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternal;
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
    if (prevApplyFlag === undefined) delete process.env.RETENTION_APPLY_ENABLED;
    else process.env.RETENTION_APPLY_ENABLED = prevApplyFlag;
  });

  const blocked = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_retention_token',
      'x-trace-id': 'trace_phase314_apply_blocked'
    },
    body: JSON.stringify({
      collections: ['events'],
      cutoffIso: '2026-01-01T00:00:00.000Z',
      dryRunTraceId: 'trace_phase314_dry_run_missing'
    })
  });
  assert.strictEqual(blocked.status, 422, blocked.body);
  const blockedPayload = JSON.parse(blocked.body);
  assert.strictEqual(blockedPayload.error, 'retention_apply_dry_run_trace_not_found');

  const dryRun = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_retention_token',
      'x-trace-id': 'trace_phase314_dry_run_ok'
    },
    body: JSON.stringify({
      collections: ['events'],
      sampleLimit: 10
    })
  });
  assert.strictEqual(dryRun.status, 200, dryRun.body);

  const ok = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_retention_token',
      'x-trace-id': 'trace_phase314_apply_ok'
    },
    body: JSON.stringify({
      collections: ['events'],
      cutoffIso: '2026-01-01T00:00:00.000Z',
      dryRunTraceId: 'trace_phase314_dry_run_ok',
      maxDeletes: 1
    })
  });
  assert.strictEqual(ok.status, 200, ok.body);
  const okPayload = JSON.parse(ok.body);
  assert.strictEqual(okPayload.ok, true);
  assert.strictEqual(okPayload.summary.deletedCount, 1);
  assert.strictEqual(okPayload.dryRunTraceId, 'trace_phase314_dry_run_ok');
});
