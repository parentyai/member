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

test('phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase261_admin_token';

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
    title: 'Vendor Link',
    url: 'https://vendor.example.com/path',
    vendorKey: 'vendor_example',
    vendorLabel: 'Vendor Example'
  });

  const authHeaders = {
    'x-admin-token': 'phase261_admin_token',
    'x-actor': 'phase261_test',
    'x-trace-id': 'trace-phase261-vendor-facade'
  };

  const listRes = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/vendors?limit=20',
    headers: authHeaders
  });
  assert.strictEqual(listRes.status, 200);
  const listBody = JSON.parse(listRes.body);
  assert.strictEqual(listBody.ok, true);
  assert.ok(Array.isArray(listBody.items));
  assert.strictEqual(listBody.items.length, 1);
  assert.strictEqual(listBody.items[0].id, link.id);

  const editRes = await httpRequest({
    port,
    method: 'POST',
    path: `/api/admin/vendors/${encodeURIComponent(link.id)}/edit`,
    headers: Object.assign({}, authHeaders, { 'content-type': 'application/json; charset=utf-8' }),
    body: JSON.stringify({ vendorLabel: 'Vendor Updated' })
  });
  assert.strictEqual(editRes.status, 200);

  const activateRes = await httpRequest({
    port,
    method: 'POST',
    path: `/api/admin/vendors/${encodeURIComponent(link.id)}/activate`,
    headers: Object.assign({}, authHeaders, { 'content-type': 'application/json; charset=utf-8' }),
    body: '{}'
  });
  assert.strictEqual(activateRes.status, 200);

  const disableRes = await httpRequest({
    port,
    method: 'POST',
    path: `/api/admin/vendors/${encodeURIComponent(link.id)}/disable`,
    headers: Object.assign({}, authHeaders, { 'content-type': 'application/json; charset=utf-8' }),
    body: '{}'
  });
  assert.strictEqual(disableRes.status, 200);

  const updated = await linkRegistryRepo.getLink(link.id);
  assert.strictEqual(updated.vendorLabel, 'Vendor Updated');
  assert.strictEqual(updated.lastHealth.state, 'WARN');
});
