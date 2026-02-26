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

test('phase668: school-calendar-audit internal job requires CITY_PACK_JOB_TOKEN and returns target summary', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase668_job_token';

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
    if (prevJobToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevJobToken;
  });

  const unauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/school-calendar-audit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.strictEqual(unauthorized.status, 401);

  const authorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/school-calendar-audit',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase668_job_token',
      'x-trace-id': 'trace_phase668_school_audit'
    },
    body: JSON.stringify({
      runId: 'run_phase668_school_audit_001',
      stage: 'heavy'
    })
  });
  assert.strictEqual(authorized.status, 200);
  const body = JSON.parse(authorized.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.runId, 'run_phase668_school_audit_001');
  assert.strictEqual(body.targetCount, 0);
  assert.deepStrictEqual(body.targetSourceRefIds, []);
});
