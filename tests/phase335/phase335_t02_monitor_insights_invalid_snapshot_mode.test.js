'use strict';

const assert = require('assert');
const { test } = require('node:test');
const { handleMonitorInsights } = require('../../src/routes/admin/monitorInsights');

function createRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload || '';
    }
  };
}

test('phase335: monitor insights returns 400 on invalid snapshotMode', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/monitor-insights?snapshotMode=invalid',
    headers: {}
  };
  const res = createRes();
  await handleMonitorInsights(req, res);
  assert.strictEqual(res.statusCode, 400);
  const body = JSON.parse(res.body || '{}');
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error, 'invalid snapshotMode');
});
