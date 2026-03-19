'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

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

async function withModuleStubs(stubMap, callback) {
  const previous = new Map();
  Object.entries(stubMap || {}).forEach(([modulePath, exports]) => {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports
    };
  });
  try {
    return await callback();
  } finally {
    previous.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: os view invalid screen emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osView');
  delete require.cache[routePath];
  const { handleView } = require('../../src/routes/admin/osView');
  const res = createResCapture();

  await handleView({
    method: 'POST',
    url: '/api/admin/os/view',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t12_invalid' }
  }, res, JSON.stringify({ screen: 'unknown' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid screen');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_screen');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_view');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_screen');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  delete require.cache[routePath];
});

test('phase900: os view success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osView');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [auditPath]: {
      appendAuditLog: async () => {}
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleView } = require('../../src/routes/admin/osView');
    const res = createResCapture();

    await handleView({
      method: 'POST',
      url: '/api/admin/os/view',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_t12_success',
        'x-request-id': 'req_phase900_t12_success'
      }
    }, res, JSON.stringify({ screen: 'monitor' }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.screen, 'monitor');
    assert.equal(body.action, 'admin_os.monitor.view');
    assert.ok(typeof body.serverTime === 'string');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_view');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: os view internal error emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osView');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [auditPath]: {
      appendAuditLog: async () => {
        throw new Error('boom');
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleView } = require('../../src/routes/admin/osView');
    const res = createResCapture();

    await handleView({
      method: 'POST',
      url: '/api/admin/os/view',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t12_error' }
    }, res, JSON.stringify({ screen: 'errors' }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_view');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
