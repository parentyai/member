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

test('security: cookie-auth state-changing requests require same-origin (CSRF guard)', async (t) => {
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

  const login = await httpRequest({
    port,
    method: 'POST',
    path: '/admin/login',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'token=test_admin_token'
  });
  assert.strictEqual(login.status, 302);

  const cookieHeader = Array.isArray(login.headers['set-cookie'])
    ? login.headers['set-cookie'].map((v) => String(v).split(';')[0]).join('; ')
    : String(login.headers['set-cookie'] || '').split(';')[0];

  // Cookie-auth + cross-origin => 403 even if endpoint would be 404.
  const blocked = await httpRequest({
    port,
    method: 'POST',
    path: '/admin/ops',
    headers: { cookie: cookieHeader, origin: 'http://evil.example' }
  });
  assert.strictEqual(blocked.status, 403);

  // Header token auth bypasses CSRF guard (CLI/scripts).
  const headerAuthed = await httpRequest({
    port,
    method: 'POST',
    path: '/admin/ops',
    headers: { 'x-admin-token': 'test_admin_token' }
  });
  assert.strictEqual(headerAuthed.status, 404);

  // Proxy-like same-origin should pass (will hit 404 because POST /admin/ops is not a route).
  const sameOrigin = await httpRequest({
    port,
    method: 'POST',
    path: '/admin/ops',
    headers: { cookie: cookieHeader, origin: `http://127.0.0.1:${port}` }
  });
  assert.strictEqual(sameOrigin.status, 404);
});

