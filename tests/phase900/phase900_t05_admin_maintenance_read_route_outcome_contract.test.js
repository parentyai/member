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

function withEnv(patch) {
  const previous = {};
  Object.keys(patch).forEach((key) => {
    previous[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  };
}

function withModuleStubs(stubMap, callback) {
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
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      previous.forEach((entry, modulePath) => {
        if (entry) require.cache[modulePath] = entry;
        else delete require.cache[modulePath];
      });
    });
}

test('phase900: read path fallback summary success emits completed outcome metadata', async () => {
  const repoPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/readPathFallbackSummary');

  await withModuleStubs({
    [repoPath]: {
      listAuditLogs: async ({ action }) => ([
        {
          id: `${action}__1`,
          action,
          actor: 'tester',
          traceId: 'trace_phase900_t05_fallback',
          requestId: 'request_phase900_t05_fallback',
          createdAt: '2026-03-18T10:00:00.000Z',
          payloadSummary: {
            fallbackUsed: action === 'read_path.fallback.dashboard_kpi',
            fallbackBlocked: false,
            fallbackSources: ['snapshot']
          }
        }
      ])
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T05_FALLBACK' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleReadPathFallbackSummary } = require('../../src/routes/admin/readPathFallbackSummary');
    const res = createResCapture();
    await handleReadPathFallbackSummary({
      method: 'GET',
      url: '/api/admin/read-path-fallback-summary?limit=5&windowHours=24',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t05_fallback' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(Array.isArray(body.recent), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.read_path_fallback_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: missing-index surface success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/missingIndexSurface');
  delete require.cache[routePath];
  const { handleMissingIndexSurface } = require('../../src/routes/admin/missingIndexSurface');
  const res = createResCapture();
  try {
    await handleMissingIndexSurface({
      method: 'GET',
      url: '/api/admin/missing-index-surface?limit=10',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t05_missing_index' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.items), true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.missing_index_surface');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: ops feature catalog disabled emits blocked outcome metadata', async () => {
  const restoreEnv = withEnv({ ENABLE_OPS_SYSTEM_SNAPSHOT_V1: '0' });
  const routePath = require.resolve('../../src/routes/admin/opsFeatureCatalogStatus');
  delete require.cache[routePath];
  const { handleOpsFeatureCatalogStatus } = require('../../src/routes/admin/opsFeatureCatalogStatus');
  const res = createResCapture();
  try {
    await handleOpsFeatureCatalogStatus({
      method: 'GET',
      url: '/api/admin/ops-feature-catalog-status',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t05_catalog_disabled' }
    }, res);
  } finally {
    restoreEnv();
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 503);
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'ops_system_snapshot_disabled');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_feature_catalog_status');
  assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'ops_system_snapshot_disabled');
});

test('phase900: ops feature catalog row-doc fallback emits degraded outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/opsFeatureCatalogStatus');
  const repoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const restoreEnv = withEnv({ ENABLE_OPS_SYSTEM_SNAPSHOT_V1: '1' });

  await withModuleStubs({
    [repoPath]: {
      getSnapshot: async () => ({
        snapshotKey: 'catalog',
        asOf: '2026-03-18T10:00:00.000Z',
        updatedAt: '2026-03-18T10:00:00.000Z',
        data: {
          rows: [
            {
              featureId: 'notice_notification',
              featureLabelJa: 'お知らせ通知',
              rowOrder: 1,
              status: 'WARN'
            }
          ]
        }
      }),
      listSnapshots: async () => {
        throw new Error('FAILED_PRECONDITION: missing index');
      }
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T05_CATALOG' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleOpsFeatureCatalogStatus } = require('../../src/routes/admin/opsFeatureCatalogStatus');
    const res = createResCapture();
    await handleOpsFeatureCatalogStatus({
      method: 'GET',
      url: '/api/admin/ops-feature-catalog-status',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t05_catalog_fallback' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.rowSource, 'catalog');
    assert.deepEqual(body.warnings, ['ROW_DOCS_UNAVAILABLE']);
    assert.equal(body.outcome && body.outcome.state, 'degraded');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_catalog_fallback');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_feature_catalog_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed_with_catalog_fallback');
    delete require.cache[routePath];
  }).finally(() => {
    restoreEnv();
  });
});
