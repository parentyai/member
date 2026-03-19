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

test('phase900: os errors summary success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osErrors');
  const linkRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const retryRepoPath = require.resolve('../../src/repos/firestore/sendRetryQueueRepo');
  const auditRepoPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [linkRepoPath]: { listLinks: async () => ([{ id: 'warn_link_1' }]) },
    [retryRepoPath]: { listPending: async () => ([{ id: 'retry_1' }]) },
    [auditRepoPath]: {
      listAuditLogs: async ({ action }) => {
        if (action === 'route_error') return [{ id: 'route_error_1' }];
        return [{ id: `${action}_1`, payloadSummary: { ok: false, reason: 'problem' } }];
      }
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T10_SUCCESS' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleErrorsSummary } = require('../../src/routes/admin/osErrors');
    const res = createResCapture();
    await handleErrorsSummary({
      method: 'GET',
      url: '/api/admin/os/errors/summary',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t10_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.warnLinks), true);
    assert.equal(Array.isArray(body.retryQueuePending), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_errors_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: os errors summary internal error emits normalized error outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osErrors');
  const linkRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const retryRepoPath = require.resolve('../../src/repos/firestore/sendRetryQueueRepo');
  const auditRepoPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [linkRepoPath]: {
      listLinks: async () => {
        throw new Error('boom');
      }
    },
    [retryRepoPath]: { listPending: async () => [] },
    [auditRepoPath]: { listAuditLogs: async () => [] },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T10_ERROR' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleErrorsSummary } = require('../../src/routes/admin/osErrors');
    const res = createResCapture();
    await handleErrorsSummary({
      method: 'GET',
      url: '/api/admin/os/errors/summary',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t10_error' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_errors_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
