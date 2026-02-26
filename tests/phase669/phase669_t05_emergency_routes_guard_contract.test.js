'use strict';

const assert = require('node:assert/strict');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');

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

test('phase669: emergency admin/internal routes require token and respect kill switch', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;

  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase669_admin_token';
  process.env.CITY_PACK_JOB_TOKEN = 'phase669_job_token';

  setDbForTest(createDbStub());
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

  const adminUnauthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/emergency/providers'
  });
  assert.equal(adminUnauthorized.status, 401);

  const adminAuthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/emergency/providers',
    headers: {
      'x-admin-token': 'phase669_admin_token',
      'x-trace-id': 'trace_phase669_admin'
    }
  });
  assert.equal(adminAuthorized.status, 200);
  const adminBody = JSON.parse(adminAuthorized.body);
  assert.equal(adminBody.ok, true);
  assert.equal(Array.isArray(adminBody.items), true);

  const internalUnauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/emergency-sync',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: 'run_phase669_internal_unauth' })
  });
  assert.equal(internalUnauthorized.status, 401);

  await systemFlagsRepo.setKillSwitch(true);
  const internalBlocked = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/emergency-sync',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase669_job_token',
      'x-trace-id': 'trace_phase669_internal_block'
    },
    body: JSON.stringify({ runId: 'run_phase669_internal_block' })
  });
  assert.equal(internalBlocked.status, 409);
  const blockedBody = JSON.parse(internalBlocked.body);
  assert.equal(blockedBody.ok, false);
  assert.equal(blockedBody.error, 'kill switch on');
});

