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
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

function httpRequest({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: Object.assign({}, headers || {})
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

test('phase261: vendor actions require and persist traceId in audit logs', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase261_admin_token_trace';

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
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const link = await linkRegistryRepo.createLink({
    title: 'Trace Target',
    url: 'https://trace.example.com'
  });

  const traceId = 'trace-phase261-vendor-action';
  const res = await httpRequest({
    port,
    method: 'POST',
    path: `/api/admin/vendors/${encodeURIComponent(link.id)}/activate`,
    headers: {
      'x-admin-token': 'phase261_admin_token_trace',
      'x-actor': 'phase261_test',
      'x-trace-id': traceId,
      'content-type': 'application/json; charset=utf-8'
    },
    body: '{}'
  });
  assert.strictEqual(res.status, 200);

  const logs = await auditLogsRepo.listAuditLogsByTraceId(traceId, 20);
  assert.ok(logs.some((item) => item.action === 'vendors.activate'));
});
