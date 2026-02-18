'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

function httpRequest({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase241: /admin/ops redirects to /admin/app when authenticated', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const blocked = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/ops',
    headers: {}
  });
  assert.strictEqual(blocked.status, 302);
  assert.strictEqual(blocked.headers.location, '/admin/login');

  const ok = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/ops',
    headers: { 'x-admin-token': 'test_admin_token' }
  });
  assert.strictEqual(ok.status, 302);
  assert.strictEqual(ok.headers.location, '/admin/app');
});
