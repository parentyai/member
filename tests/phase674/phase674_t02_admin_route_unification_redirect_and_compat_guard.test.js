'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const {
  ADMIN_UI_ROUTES_V2,
  buildAdminAppPaneLocation
} = require('../../src/shared/adminUiRoutesV2');

function request({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase674: /admin/* routes converge to /admin/app and compat is guarded by role+confirm', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevConfirm = process.env.ADMIN_UI_COMPAT_CONFIRM_TOKEN;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase674_admin_token';
  process.env.ADMIN_UI_COMPAT_CONFIRM_TOKEN = 'phase674_confirm';

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
    if (prevConfirm === undefined) delete process.env.ADMIN_UI_COMPAT_CONFIRM_TOKEN;
    else process.env.ADMIN_UI_COMPAT_CONFIRM_TOKEN = prevConfirm;
  });

  const authHeaders = { 'x-admin-token': 'phase674_admin_token' };

  for (const entry of ADMIN_UI_ROUTES_V2) {
    if (entry.type !== 'redirect_to_app_pane') continue;
    const res = await request({
      port,
      method: 'GET',
      path: entry.route,
      headers: authHeaders
    });
    assert.equal(res.status, 302, `${entry.route} should redirect`);
    assert.equal(res.headers.location, buildAdminAppPaneLocation(entry.pane), `${entry.route} redirect target mismatch`);
  }

  const compatDenied = await request({
    port,
    method: 'GET',
    path: '/admin/master?compat=1&role=admin',
    headers: authHeaders
  });
  assert.equal(compatDenied.status, 302);
  assert.equal(compatDenied.headers.location, '/admin/app?pane=maintenance');

  const compatWrongRole = await request({
    port,
    method: 'GET',
    path: '/admin/master?compat=1&role=operator&confirm=phase674_confirm',
    headers: authHeaders
  });
  assert.equal(compatWrongRole.status, 302);
  assert.equal(compatWrongRole.headers.location, '/admin/app?pane=maintenance');

  const compatAllowed = await request({
    port,
    method: 'GET',
    path: '/admin/master?compat=1&role=admin&confirm=phase674_confirm',
    headers: authHeaders
  });
  assert.equal(compatAllowed.status, 200);
  assert.match(compatAllowed.body, /設定\/回復（Master/);
});
