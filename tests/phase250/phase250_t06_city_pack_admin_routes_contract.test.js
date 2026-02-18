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
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

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

test('phase250: review inbox requires admin token and internal audit route requires job token', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;

  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';
  process.env.CITY_PACK_JOB_TOKEN = 'phase250_job_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

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
    if (prevJobToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevJobToken;
  });

  await sourceRefsRepo.createSourceRef({
    id: 'sr_route',
    url: 'https://example.com/route',
    status: 'needs_review',
    validFrom: '2026-02-01T00:00:00.000Z',
    validUntil: '2026-06-01T00:00:00.000Z',
    riskLevel: 'medium'
  });

  const noToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox'
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox?status=needs_review&limit=10',
    headers: {
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_test'
    }
  });
  assert.strictEqual(withToken.status, 200);
  const inbox = JSON.parse(withToken.body);
  assert.strictEqual(inbox.ok, true);
  assert.ok(Array.isArray(inbox.items));
  assert.strictEqual(inbox.items.length, 1);
  assert.strictEqual(inbox.items[0].sourceRefId, 'sr_route');

  const internalUnauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-source-audit',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ runId: 'run_route_internal_001', targetSourceRefIds: ['sr_route'] })
  });
  assert.strictEqual(internalUnauthorized.status, 401);

  const internalAuthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-source-audit',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase250_job_token'
    },
    body: JSON.stringify({ runId: 'run_route_internal_001', targetSourceRefIds: ['sr_route'], traceId: 'trace_route_internal_001' })
  });
  assert.strictEqual(internalAuthorized.status, 200);
  const body = JSON.parse(internalAuthorized.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.runId, 'run_route_internal_001');
});
