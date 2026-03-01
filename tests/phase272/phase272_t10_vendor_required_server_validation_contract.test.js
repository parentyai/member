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

test('phase272: VENDOR draft rejects with 422 when notificationMeta.vendorId is missing', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase272_vendor_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const link = await linkRegistryRepo.createLink({
    title: 'Phase272 Vendor Link',
    url: 'https://example.com/vendor-phase272',
    lastHealth: { state: 'OK' }
  });

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
  });

  const payload = JSON.stringify({
    title: 'Vendor alert',
    body: 'body',
    ctaText: 'Open',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: 'week',
    notificationType: 'VENDOR',
    notificationMeta: {},
    target: { limit: 50 }
  });
  const res = await request({
    port,
    method: 'POST',
    path: '/api/admin/os/notifications/draft',
    headers: {
      'x-admin-token': 'phase272_vendor_token',
      'x-actor': 'phase272_vendor_test',
      'x-trace-id': 'trace_phase272_vendor_missing',
      'content-type': 'application/json; charset=utf-8'
    },
    body: payload
  });

  assert.strictEqual(res.status, 422);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error, 'notificationMeta.vendorId required');
});

