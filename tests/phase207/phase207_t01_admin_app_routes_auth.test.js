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

test('phase207: /admin/app and /admin/ui-dict are protected by admin token', async (t) => {
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

  const appBlocked = await httpRequest({ port, method: 'GET', path: '/admin/app', headers: {} });
  assert.strictEqual(appBlocked.status, 302);
  assert.strictEqual(appBlocked.headers.location, '/admin/login');

  const dictBlocked = await httpRequest({ port, method: 'GET', path: '/admin/ui-dict', headers: {} });
  assert.strictEqual(dictBlocked.status, 302);
  assert.strictEqual(dictBlocked.headers.location, '/admin/login');
});

test('phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present', async (t) => {
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

  const appAuthed = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/app',
    headers: { 'x-admin-token': 'test_admin_token' }
  });
  assert.strictEqual(appAuthed.status, 200);
  assert.ok(appAuthed.body.includes('id="app-shell"'));
  assert.ok(appAuthed.body.includes('/admin/assets/admin_app.js'));

  const dictAuthed = await httpRequest({
    port,
    method: 'GET',
    path: '/admin/ui-dict',
    headers: { 'x-admin-token': 'test_admin_token' }
  });
  assert.strictEqual(dictAuthed.status, 200);
  assert.ok(String(dictAuthed.headers['content-type'] || '').includes('application/json'));

  const body = JSON.parse(dictAuthed.body);
  assert.strictEqual(typeof body, 'object');
  assert.strictEqual(body['ui.label.app.title'], '通知運用ダッシュボード（Linear UI）');
  assert.strictEqual(body['ui.label.nav.compose'], '通知配信');
  assert.strictEqual(body['ui.label.panel.actions'], '操作パネル');
});
