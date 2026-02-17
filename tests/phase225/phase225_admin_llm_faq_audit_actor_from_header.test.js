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

test('phase225: admin llm faq audit actor uses x-actor header when provided', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const traceId = 'TRACE_LLM_FAQ_ACTOR_1';
  const res = await request({
    port,
    method: 'POST',
    path: '/api/admin/llm/faq/answer',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'admin_master',
      'x-trace-id': traceId,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ question: '会員番号の確認方法は？', locale: 'ja' })
  });

  // Disabled-by-default: endpoint may return 422, but must still append audit log with actor/traceId.
  assert.notStrictEqual(res.status, 401);

  const state = db._state;
  assert.ok(state && state.collections && state.collections.audit_logs);
  const docs = Object.values(state.collections.audit_logs.docs || {}).map((item) => item && item.data ? item.data : null).filter(Boolean);
  const hit = docs.find((row) => row.action === 'llm_faq_answer_blocked' && row.traceId === traceId);
  assert.ok(hit, 'expected blocked audit log row');
  assert.strictEqual(hit.actor, 'admin_master');
});

