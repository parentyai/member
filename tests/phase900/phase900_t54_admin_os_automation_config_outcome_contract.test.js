'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleSet } = require('../../src/routes/admin/osAutomationConfig');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      result.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    readJson() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

function req(traceId) {
  return {
    method: 'POST',
    url: '/api/admin/os/automation-config/set',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': traceId,
      'x-request-id': traceId
    }
  };
}

test('phase900: os automation config set missing confirm token emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleSet(req('trace_phase900_t54_confirm_required'), res, JSON.stringify({
    mode: 'EXECUTE'
  }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'planHash/confirmToken required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'confirm_token_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_automation_config');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'confirm_token_required');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: os automation config set invalid json emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleSet(req('trace_phase900_t54_invalid_json'), res, '{');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid json');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_automation_config');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});
