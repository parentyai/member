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
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');
const { setKillSwitch } = require('../../src/repos/firestore/systemFlagsRepo');

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

test('phase306: kill switch blocks city pack admin/internal write operations', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase306_admin_token';
  process.env.CITY_PACK_JOB_TOKEN = 'phase306_job_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const requestRow = await cityPackRequestsRepo.createRequest({
    lineUserId: 'line_u_block_306',
    regionCity: 'Austin',
    regionState: 'TX',
    regionKey: 'TX::austin',
    traceId: 'trace_306_block',
    status: 'drafted',
    draftCityPackIds: ['cp_dummy']
  });

  await setKillSwitch(true);

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

  const adminRes = await request({
    port,
    method: 'POST',
    path: `/api/admin/city-pack-requests/${encodeURIComponent(requestRow.id)}/approve`,
    headers: {
      'x-admin-token': 'phase306_admin_token',
      'x-actor': 'phase306_test',
      'content-type': 'application/json'
    },
    body: '{}'
  });
  assert.strictEqual(adminRes.status, 409);
  assert.match(adminRes.body, /kill switch on/);

  const internalRes = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-draft-generator',
    headers: {
      'x-city-pack-job-token': 'phase306_job_token',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ requestId: requestRow.id })
  });
  assert.strictEqual(internalRes.status, 409);
  assert.match(internalRes.body, /kill switch on/);
});
