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

async function withProductReadinessHandler(overrides, run) {
  const flagsPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const snapshotsPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');
  const auditsPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const appendAuditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/productReadiness');

  const originalFlags = require.cache[flagsPath];
  const originalSnapshots = require.cache[snapshotsPath];
  const originalAudits = require.cache[auditsPath];
  const originalAppendAudit = require.cache[appendAuditPath];
  const originalRoute = require.cache[routePath];

  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: Object.assign({
      getKillSwitch: async () => false
    }, overrides && overrides.systemFlagsRepo || {})
  };
  require.cache[snapshotsPath] = {
    id: snapshotsPath,
    filename: snapshotsPath,
    loaded: true,
    exports: Object.assign({
      listSnapshots: async () => ([{ asOf: new Date().toISOString() }])
    }, overrides && overrides.opsSnapshotsRepo || {})
  };
  require.cache[auditsPath] = {
    id: auditsPath,
    filename: auditsPath,
    loaded: true,
    exports: Object.assign({
      listAuditLogs: async () => ([])
    }, overrides && overrides.auditLogsRepo || {})
  };
  require.cache[appendAuditPath] = {
    id: appendAuditPath,
    filename: appendAuditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_phase900_t45' })
    }, overrides && overrides.appendAuditLog || {})
  };
  delete require.cache[routePath];

  try {
    const { handleProductReadiness } = require('../../src/routes/admin/productReadiness');
    await run(handleProductReadiness);
  } finally {
    if (originalFlags) require.cache[flagsPath] = originalFlags;
    else delete require.cache[flagsPath];
    if (originalSnapshots) require.cache[snapshotsPath] = originalSnapshots;
    else delete require.cache[snapshotsPath];
    if (originalAudits) require.cache[auditsPath] = originalAudits;
    else delete require.cache[auditsPath];
    if (originalAppendAudit) require.cache[appendAuditPath] = originalAppendAudit;
    else delete require.cache[appendAuditPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: product readiness success emits completed outcome metadata', async () => {
  await withProductReadinessHandler({}, async (handleProductReadiness) => {
    const res = createResCapture();
    await handleProductReadiness({
      method: 'GET',
      url: '/api/admin/product-readiness?windowHours=24',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t45_success',
        'x-request-id': 'req_phase900_t45_success'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.product_readiness');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: product readiness kill switch blocker still emits successful outcome metadata', async () => {
  await withProductReadinessHandler({
    systemFlagsRepo: {
      getKillSwitch: async () => true
    }
  }, async (handleProductReadiness) => {
    const res = createResCapture();
    await handleProductReadiness({
      method: 'GET',
      url: '/api/admin/product-readiness',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t45_killswitch'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, 'NO_GO');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.product_readiness');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: product readiness internal failure emits normalized error outcome metadata', async () => {
  await withProductReadinessHandler({
    opsSnapshotsRepo: {
      listSnapshots: async () => {
        throw new Error('boom');
      }
    }
  }, async (handleProductReadiness) => {
    const res = createResCapture();
    await handleProductReadiness({
      method: 'GET',
      url: '/api/admin/product-readiness',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t45_error',
        'x-request-id': 'req_phase900_t45_error'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.product_readiness');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
