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

test('implementation targets api: returns fixed registry', async () => {
  const res = createRes();
  const req = { url: '/admin/implementation-targets' };

  await handleImplementationTargets(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
  const payload = JSON.parse(res.body);
  assert.ok(Array.isArray(payload));
  assert.strictEqual(payload.length, 1);
  assert.strictEqual(payload[0].id, 'CO1-D-001-A01');
});
