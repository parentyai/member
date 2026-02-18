'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

function httpRequest({ port, method, path, headers, body }) {
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
    if (body) req.write(body);
    req.end();
  });
}

test('security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login)', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  const { createServer } = require('../../src/index.js');
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

  const redirect = await httpRequest({ port, method: 'GET', path: '/admin/ops', headers: {} });
  assert.strictEqual(redirect.status, 302);
  assert.strictEqual(redirect.headers.location, '/admin/login');

  const login = await httpRequest({
    port,
    method: 'POST',
    path: '/admin/login',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'token=test_admin_token'
  });
  assert.strictEqual(login.status, 302);
  assert.strictEqual(login.headers.location, '/admin/ops');
  const setCookie = String(login.headers['set-cookie'] || '');
  assert.ok(setCookie.includes('admin_token='), 'expected admin_token cookie');

  // Use the cookie for subsequent access.
  const cookieHeader = Array.isArray(login.headers['set-cookie'])
    ? login.headers['set-cookie'].map((v) => String(v).split(';')[0]).join('; ')
    : String(login.headers['set-cookie'] || '').split(';')[0];

  const authed = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/ops',
    headers: { cookie: cookieHeader }
  });
  assert.strictEqual(authed.status, 302);
  assert.strictEqual(authed.headers.location, '/admin/app');
});
