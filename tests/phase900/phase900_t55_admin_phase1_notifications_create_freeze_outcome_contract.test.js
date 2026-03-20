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
    readJson() {
      return JSON.parse(result.body || '{}');
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

async function withLegacyFreezeEnabled(run) {
  const previous = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  process.env.LEGACY_ROUTE_FREEZE_ENABLED = '1';
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.LEGACY_ROUTE_FREEZE_ENABLED;
    else process.env.LEGACY_ROUTE_FREEZE_ENABLED = previous;
  }
}

test('phase900: legacy phase1 notifications create freeze emits blocked outcome headers', async () => {
  await withLegacyFreezeEnabled(async () => {
    const res = createResCapture();
    await handleCreatePhase1(req('trace_phase900_t55_create_freeze'), res, JSON.stringify({
      title: 'legacy-phase1',
      body: 'body'
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 410);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'legacy route frozen');
    assert.equal(body.replacement, LEGACY_SUCCESSOR);
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'legacy_route_frozen');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    assert.equal(res.result.headers.deprecation, 'true');
    assert.equal(res.result.headers.sunset, LEGACY_SUNSET);
    assert.equal(res.result.headers.link, `<${LEGACY_SUCCESSOR}>; rel="successor-version"`);
  });
});
