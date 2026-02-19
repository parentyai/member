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

test('phase268: internal light/heavy city pack audit routes require token and set stage', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase268_job_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceRefsRepo.createSourceRef({
    id: 'sr_phase268_internal',
    url: 'https://example.com/internal',
    status: 'needs_review',
    validUntil: '2099-01-01T00:00:00.000Z'
  });

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
    if (prevJobToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevJobToken;
  });

  const blocked = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-audit-light',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: 'run_phase268_light', targetSourceRefIds: ['sr_phase268_internal'] })
  });
  assert.strictEqual(blocked.status, 401);

  const light = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-audit-light',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase268_job_token'
    },
    body: JSON.stringify({ runId: 'run_phase268_light', targetSourceRefIds: ['sr_phase268_internal'], traceId: 'trace_phase268_light' })
  });
  assert.strictEqual(light.status, 200);
  const lightBody = JSON.parse(light.body);
  assert.strictEqual(lightBody.ok, true);
  assert.strictEqual(lightBody.stage, 'light');

  const heavy = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/city-pack-audit-heavy',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase268_job_token'
    },
    body: JSON.stringify({ runId: 'run_phase268_heavy', targetSourceRefIds: ['sr_phase268_internal'], traceId: 'trace_phase268_heavy' })
  });
  assert.strictEqual(heavy.status, 200);
  const heavyBody = JSON.parse(heavy.body);
  assert.strictEqual(heavyBody.ok, true);
  assert.strictEqual(heavyBody.stage, 'heavy');
});
