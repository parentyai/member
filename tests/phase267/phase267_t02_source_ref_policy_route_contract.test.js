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
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

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

test('phase267: source policy route requires admin token and writes audit', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase267_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceRefsRepo.createSourceRef({
    id: 'sr_policy_route_267',
    url: 'https://example.com/source-policy-route',
    status: 'needs_review'
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
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const noToken = await request({
    port,
    method: 'POST',
    path: '/api/admin/source-refs/sr_policy_route_267/policy',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceType: 'community', requiredLevel: 'optional' })
  });
  assert.strictEqual(noToken.status, 401);

  const traceId = 'trace_phase267_source_policy';
  const withToken = await request({
    port,
    method: 'POST',
    path: '/api/admin/source-refs/sr_policy_route_267/policy',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase267_admin_token',
      'x-actor': 'phase267_test',
      'x-trace-id': traceId
    },
    body: JSON.stringify({ sourceType: 'community', requiredLevel: 'optional' })
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.sourceType, 'community');
  assert.strictEqual(body.requiredLevel, 'optional');

  const sourceRef = await sourceRefsRepo.getSourceRef('sr_policy_route_267');
  assert.strictEqual(sourceRef.sourceType, 'community');
  assert.strictEqual(sourceRef.requiredLevel, 'optional');

  const logs = await auditLogsRepo.listAuditLogsByTraceId(traceId, 20);
  assert.ok(logs.some((item) => item.action === 'city_pack.source_policy.update'));
});
