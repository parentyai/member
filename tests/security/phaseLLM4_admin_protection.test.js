'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('security: /api/phaseLLM4/faq/answer is protected by admin token', async (t) => {
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

  const blocked = await request({
    port,
    method: 'POST',
    path: '/api/phaseLLM4/faq/answer',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ question: 'Q' })
  });
  assert.strictEqual(blocked.status, 401);

  const authed = await request({
    port,
    method: 'POST',
    path: '/api/phaseLLM4/faq/answer',
    headers: {
      'x-admin-token': 'test_admin_token',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ question: 'Q' })
  });
  // authenticated path may return 422(blocked) or 500(adapter missing) depending deps,
  // but must not return 401 once token is valid.
  assert.notStrictEqual(authed.status, 401);
});
