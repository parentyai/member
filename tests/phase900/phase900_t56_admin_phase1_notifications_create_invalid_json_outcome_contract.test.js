'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCreatePhase1 } = require('../../src/routes/admin/phase1Notifications');

const LEGACY_SUCCESSOR = '/api/admin/os/notifications/list';
const LEGACY_SUNSET = 'Wed, 30 Sep 2026 00:00:00 GMT';

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
    result
  };
}

function req(traceId) {
  return {
    method: 'POST',
    url: '/admin/phase1/notifications',
    headers: {
      'x-request-id': traceId,
      'x-trace-id': traceId
    }
  };
}

async function withLegacyFreezeDisabled(run) {
  const previous = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  delete process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.LEGACY_ROUTE_FREEZE_ENABLED;
    else process.env.LEGACY_ROUTE_FREEZE_ENABLED = previous;
  }
}

test('phase900: legacy phase1 notifications create invalid json emits normalized error headers', async () => {
  await withLegacyFreezeDisabled(async () => {
    const res = createResCapture();
    await handleCreatePhase1(req('trace_phase900_t56_create_invalid_json'), res, '{');

    assert.equal(res.result.statusCode, 400);
    assert.equal(res.result.body, 'invalid json');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    assert.equal(res.result.headers.deprecation, 'true');
    assert.equal(res.result.headers.sunset, LEGACY_SUNSET);
    assert.equal(res.result.headers.link, `<${LEGACY_SUCCESSOR}>; rel="successor-version"`);
  });
});
