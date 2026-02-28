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
      headers: headers || {}
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

test('phase634: legacy compatibility routes return 410 when freeze flag is enabled', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevLegacyFreeze = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase634_admin_token';
  process.env.LEGACY_ROUTE_FREEZE_ENABLED = '1';

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
    if (prevLegacyFreeze === undefined) delete process.env.LEGACY_ROUTE_FREEZE_ENABLED;
    else process.env.LEGACY_ROUTE_FREEZE_ENABLED = prevLegacyFreeze;
  });

  const headers = {
    'content-type': 'application/json',
    'x-admin-token': 'phase634_admin_token'
  };
  const requests = [
    { path: '/api/phase105/ops-assist/adopt', method: 'POST', body: '{}' },
    { path: '/api/phase121/ops/notice/send', method: 'POST', body: '{}' },
    { path: '/api/phase1/events', method: 'POST', body: '{}' },
    { path: '/admin/phase1/notifications', method: 'POST', body: '{}' },
    { path: '/api/phaseLLM4/faq/answer', method: 'POST', body: '{}' }
  ];

  for (const req of requests) {
    const res = await httpRequest({
      port,
      method: req.method,
      path: req.path,
      headers,
      body: req.body
    });
    assert.strictEqual(res.status, 410, `expected 410 for ${req.path}`);
  }
});

test('phase634: legacy freeze flag default-off keeps route behavior available', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevLegacyFreeze = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase634_admin_token';
  process.env.LEGACY_ROUTE_FREEZE_ENABLED = '0';

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
    if (prevLegacyFreeze === undefined) delete process.env.LEGACY_ROUTE_FREEZE_ENABLED;
    else process.env.LEGACY_ROUTE_FREEZE_ENABLED = prevLegacyFreeze;
  });

  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/api/phase1/events',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase634_admin_token'
    },
    body: JSON.stringify({ type: 'opened', lineUserId: 'U1' })
  });

  assert.notStrictEqual(res.status, 410);
});
