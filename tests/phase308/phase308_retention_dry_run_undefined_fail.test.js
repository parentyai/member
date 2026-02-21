'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');

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

test('phase308: retention dry-run fails closed on undefined collection policy', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevInternalToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  if (prevAdminToken !== undefined) delete process.env.ADMIN_OS_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase308_retention_token';

  setDbForTest(createDbStub());

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
    if (prevInternalToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternalToken;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase308_retention_token',
      'x-trace-id': 'trace_phase308_retention_undefined'
    },
    body: JSON.stringify({ collections: ['undefined_collection_xyz'] })
  });

  assert.strictEqual(res.status, 422);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.error, 'retention_policy_undefined');
  assert.ok(Array.isArray(payload.summary.undefinedCollections));
  assert.ok(payload.summary.undefinedCollections.includes('undefined_collection_xyz'));
});
