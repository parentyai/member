'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { handleOpsDailyJob } = require('../../src/routes/phase65OpsDailyJob');

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

test('phase65: job token required', async () => {
  const original = process.env.OPS_JOB_TOKEN;
  delete process.env.OPS_JOB_TOKEN;

  const res = createRes();
  const req = { url: '/api/phase65/ops/jobs/daily-report', headers: {} };
  await handleOpsDailyJob(req, res, { generateOpsDailyReport: async () => ({ ok: true }) });

  assert.strictEqual(res.statusCode, 403);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.error, 'job token required');

  if (original) process.env.OPS_JOB_TOKEN = original;
});
