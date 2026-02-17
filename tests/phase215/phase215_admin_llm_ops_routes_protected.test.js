'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

function request({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const blockedOps = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/ops-explain?lineUserId=U1'
  });
  assert.strictEqual(blockedOps.status, 401);

  const blockedNext = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/next-actions?lineUserId=U1'
  });
  assert.strictEqual(blockedNext.status, 401);

  const authedOps = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/ops-explain?lineUserId=U1',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'phase215_test'
    }
  });
  assert.notStrictEqual(authedOps.status, 401);

  const authedNext = await request({
    port,
    method: 'GET',
    path: '/api/admin/llm/next-actions?lineUserId=U1',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'phase215_test'
    }
  });
  assert.notStrictEqual(authedNext.status, 401);
});
