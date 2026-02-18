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

test('phase260: internal city-pack draft job requires token', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase260_job_token';

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
    if (prevJobToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevJobToken;
  });

  const requestRec = await cityPackRequestsRepo.createRequest({
    lineUserId: 'line_u_req_job',
    regionCity: 'Austin',
    regionState: 'TX',
    regionKey: 'TX::austin',
    traceId: 'trace_job'
  });

  const noToken = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-draft-generator',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: requestRec.id })
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-draft-generator',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase260_job_token'
    },
    body: JSON.stringify({ requestId: requestRec.id, sourceUrls: ['https://example.com/tx/austin'] })
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
});
