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

test('phase900: os users summary export success emits completed outcome headers with csv payload', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUsersSummaryExport');
  const usecasePath = require.resolve('../../src/usecases/phase5/getUsersSummaryFiltered');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [usecasePath]: {
      getUsersSummaryFiltered: async () => ([{
        lineUserId: 'U_EXPORT_USER_123456',
        memberNumber: 'MBR123456',
        plan: 'pro',
        subscriptionStatus: 'active',
        billingIntegrityState: 'ok',
        deliveryCount: 10,
        clickCount: 4,
        reactionRate: 0.4
      }])
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T35_SUCCESS' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleUsersSummaryExport } = require('../../src/routes/admin/osUsersSummaryExport');
    const res = createResCapture();
    await handleUsersSummaryExport({
      method: 'GET',
      url: '/api/admin/os/users-summary/export?limit=100&analyticsLimit=500&quickFilter=all',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_t35_success',
        'x-request-id': 'req_phase900_t35_success'
      }
    }, res);

    assert.equal(res.result.statusCode, 200);
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    assert.ok((res.result.headers['content-type'] || '').includes('text/csv'));
    assert.ok(String(res.result.body || '').startsWith('lineUserIdMasked,memberNumberMasked'));
    assert.ok(!String(res.result.body || '').includes('U_EXPORT_USER_123456'));
    delete require.cache[routePath];
  });
});

test('phase900: os users summary export invalid query emits normalized error outcome payload', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUsersSummaryExport');
  const usecasePath = require.resolve('../../src/usecases/phase5/getUsersSummaryFiltered');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [usecasePath]: { getUsersSummaryFiltered: async () => ([]) },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T35_INVALID' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleUsersSummaryExport } = require('../../src/routes/admin/osUsersSummaryExport');
    const res = createResCapture();
    await handleUsersSummaryExport({
      method: 'GET',
      url: '/api/admin/os/users-summary/export?limit=0',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_t35_invalid',
        'x-request-id': 'req_phase900_t35_invalid'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid limit');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_query');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_users_summary_export');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_query');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: os users summary export internal failure emits normalized error outcome payload', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUsersSummaryExport');
  const usecasePath = require.resolve('../../src/usecases/phase5/getUsersSummaryFiltered');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [usecasePath]: {
      getUsersSummaryFiltered: async () => {
        throw new Error('boom');
      }
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T35_ERROR' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleUsersSummaryExport } = require('../../src/routes/admin/osUsersSummaryExport');
    const res = createResCapture();
    await handleUsersSummaryExport({
      method: 'GET',
      url: '/api/admin/os/users-summary/export?limit=100&analyticsLimit=500',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_t35_error',
        'x-request-id': 'req_phase900_t35_error'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_users_summary_export');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
