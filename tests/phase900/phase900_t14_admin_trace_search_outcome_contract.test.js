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

test('phase900: admin trace search success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/traceSearch');
  const bundlePath = require.resolve('../../src/usecases/admin/getTraceBundle');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [bundlePath]: {
      getTraceBundle: async ({ traceId }) => ({
        ok: true,
        traceId,
        audits: [],
        decisions: [],
        timeline: [],
        traceJoinSummary: { completeness: 1, joinedDomains: [], missingDomains: [] }
      })
    },
    [auditPath]: {
      appendAuditLog: async () => {}
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminTraceSearch } = require('../../src/routes/admin/traceSearch');
    const res = createResCapture();

    await handleAdminTraceSearch({
      method: 'GET',
      url: '/api/admin/trace?traceId=TRACE_PHASE900&limit=20',
      headers: {
        'x-actor': 'tester',
        'x-request-id': 'req_phase900_t14_success'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.traceId, 'TRACE_PHASE900');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.trace_search');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: admin trace search invalid request emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/traceSearch');
  const bundlePath = require.resolve('../../src/usecases/admin/getTraceBundle');

  await withModuleStubs({
    [bundlePath]: {
      getTraceBundle: async () => {
        throw new Error('traceId required');
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminTraceSearch } = require('../../src/routes/admin/traceSearch');
    const res = createResCapture();

    await handleAdminTraceSearch({
      method: 'GET',
      url: '/api/admin/trace',
      headers: {
        'x-actor': 'tester',
        'x-request-id': 'req_phase900_t14_invalid'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'traceId required');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_request');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.trace_search');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_request');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: admin trace search internal error emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/traceSearch');
  const bundlePath = require.resolve('../../src/usecases/admin/getTraceBundle');

  await withModuleStubs({
    [bundlePath]: {
      getTraceBundle: async () => {
        throw new Error('boom');
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleAdminTraceSearch } = require('../../src/routes/admin/traceSearch');
    const res = createResCapture();

    await handleAdminTraceSearch({
      method: 'GET',
      url: '/api/admin/trace?traceId=TRACE_PHASE900_ERR',
      headers: {
        'x-actor': 'tester',
        'x-request-id': 'req_phase900_t14_error'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.traceId, 'TRACE_PHASE900_ERR');
    assert.equal(body.requestId, 'req_phase900_t14_error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.trace_search');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
