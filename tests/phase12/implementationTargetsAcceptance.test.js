'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { handleImplementationTargets } = require('../../src/routes/admin/implementationTargets');

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

async function callHandler(url) {
  const res = createRes();
  const req = { url };
  await handleImplementationTargets(req, res);
  return res;
}

test('implementation targets acceptance: fixed single IN target', async () => {
  const res = await callHandler('/admin/implementation-targets');

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
  const payload = JSON.parse(res.body);
  assert.ok(Array.isArray(payload));
  assert.strictEqual(payload.length, 1);
  assert.strictEqual(payload[0].id, 'CO1-D-001-A01');
  assert.strictEqual(payload[0].status, 'IN');
});

test('implementation targets acceptance: query does not change result', async () => {
  const res1 = await callHandler('/admin/implementation-targets');
  const res2 = await callHandler('/admin/implementation-targets?noop=1');

  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res1.body, res2.body);
});
