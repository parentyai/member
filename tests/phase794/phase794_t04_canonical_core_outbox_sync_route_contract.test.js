'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const { handleCanonicalCoreOutboxSyncJob } = require('../../src/routes/internal/canonicalCoreOutboxSyncJob');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      Object.entries(headers || {}).forEach(([name, value]) => {
        this.headers[String(name).toLowerCase()] = String(value);
      });
    },
    end(text) {
      this.body = typeof text === 'string' ? text : '';
    }
  };
}

test('phase794: canonical core outbox sync route requires internal token and handles dry-run payload', async (t) => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase794_job_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('canonical_core_outbox').doc('cco_phase794_1').set({
    sinkStatus: 'pending',
    objectType: 'source_snapshot',
    objectId: 'sr_phase794_1',
    eventType: 'upsert',
    createdAt: '2026-03-10T00:00:00.000Z'
  }, { merge: true });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  });

  const unauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/canonical-core-outbox-sync',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ dryRun: true, limit: 5 })
  });
  assert.equal(unauthorized.status, 401);
  const unauthorizedBody = JSON.parse(unauthorized.body);
  assert.equal(unauthorizedBody.outcome && unauthorizedBody.outcome.state, 'blocked');
  assert.equal(unauthorizedBody.outcome && unauthorizedBody.outcome.reason, 'unauthorized');
  assert.equal(unauthorizedBody.outcome && unauthorizedBody.outcome.routeType, 'internal_job');
  assert.equal(unauthorizedBody.outcome && unauthorizedBody.outcome.guard && unauthorizedBody.outcome.guard.routeKey, 'internal_canonical_core_outbox_sync_job');

  const invalidJson = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/canonical-core-outbox-sync',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-city-pack-job-token': 'phase794_job_token'
    },
    body: '{"dryRun":true'
  });
  assert.equal(invalidJson.status, 400);
  const invalidJsonBody = JSON.parse(invalidJson.body);
  assert.equal(invalidJsonBody.outcome && invalidJsonBody.outcome.state, 'error');
  assert.equal(invalidJsonBody.outcome && invalidJsonBody.outcome.reason, 'invalid_json');
  assert.equal(invalidJsonBody.outcome && invalidJsonBody.outcome.routeType, 'internal_job');
  assert.equal(invalidJsonBody.outcome && invalidJsonBody.outcome.guard && invalidJsonBody.outcome.guard.routeKey, 'internal_canonical_core_outbox_sync_job');

  const allowed = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/canonical-core-outbox-sync',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-city-pack-job-token': 'phase794_job_token',
      'x-trace-id': 'phase794_route_trace'
    },
    body: JSON.stringify({ dryRun: true, limit: 5 })
  });
  assert.equal(allowed.status, 200);
  const payload = JSON.parse(allowed.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.equal(payload.scannedCount, 1);
  assert.equal(payload.items[0].id, 'cco_phase794_1');
  assert.equal(payload.items[0].outcome, 'dry_run');
  assert.equal(payload.outcome && payload.outcome.state, 'success');
  assert.equal(payload.outcome && payload.outcome.reason, 'dry_run');
  assert.equal(payload.outcome && payload.outcome.routeType, 'internal_job');
  assert.equal(payload.outcome && payload.outcome.guard && payload.outcome.guard.routeKey, 'internal_canonical_core_outbox_sync_job');
});

test('phase794: canonical core outbox sync handler returns not_found outcome for non-POST requests', async () => {
  const res = createResponseRecorder();
  await handleCanonicalCoreOutboxSyncJob({
    method: 'GET',
    url: '/internal/jobs/canonical-core-outbox-sync',
    headers: {}
  }, res, '');
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'not_found');
  assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_canonical_core_outbox_sync_job');
});
