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

test('phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed)', async (t) => {
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

  const explainNoToken = await request({ port, method: 'GET', path: '/api/admin/llm/ops-explain' });
  assert.strictEqual(explainNoToken.status, 401);

  const nextNoToken = await request({ port, method: 'GET', path: '/api/admin/llm/next-actions' });
  assert.strictEqual(nextNoToken.status, 401);

  const headers = { 'x-admin-token': 'test_admin_token' };

  const explainAuthed = await request({ port, method: 'GET', path: '/api/admin/llm/ops-explain', headers });
  // With valid token, request reaches handler and fails with missing lineUserId (400), but must not be 401.
  assert.notStrictEqual(explainAuthed.status, 401);

  const nextAuthed = await request({ port, method: 'GET', path: '/api/admin/llm/next-actions', headers });
  assert.notStrictEqual(nextAuthed.status, 401);
});

