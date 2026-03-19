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

test('phase900: ops system snapshot view returns blocked outcome when disabled', async () => {
  const restoreEnv = withEnv({ ENABLE_OPS_SYSTEM_SNAPSHOT_V1: '0' });
  const routePath = require.resolve('../../src/routes/admin/opsSystemSnapshot');
  delete require.cache[routePath];
  const { handleOpsSystemSnapshot } = require('../../src/routes/admin/opsSystemSnapshot');
  const res = createResCapture();
  try {
    await handleOpsSystemSnapshot({
      method: 'GET',
      url: '/api/admin/ops-system-snapshot',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_snapshot_disabled' }
    }, res);
  } finally {
    restoreEnv();
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 503);
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'ops_system_snapshot_disabled');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_system_snapshot');
  assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'ops_system_snapshot_disabled');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: ops system snapshot rebuild invalid json emits error outcome metadata', async () => {
  const restoreEnv = withEnv({ ENABLE_OPS_SYSTEM_SNAPSHOT_V1: '1' });
  const routePath = require.resolve('../../src/routes/admin/opsSystemSnapshot');
  delete require.cache[routePath];
  const { handleOpsSystemSnapshotRebuild } = require('../../src/routes/admin/opsSystemSnapshot');
  const res = createResCapture();
  try {
    await handleOpsSystemSnapshotRebuild({
      method: 'POST',
      url: '/api/admin/ops-system-snapshot/rebuild',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_snapshot_invalid_json' }
    }, res, '{');
  } finally {
    restoreEnv();
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_system_snapshot_rebuild');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
});

test('phase900: ops snapshot health invalid staleAfterMinutes emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/opsSnapshotHealth');
  delete require.cache[routePath];
  const { handleOpsSnapshotHealth } = require('../../src/routes/admin/opsSnapshotHealth');
  const res = createResCapture();
  try {
    await handleOpsSnapshotHealth({
      method: 'GET',
      url: '/api/admin/ops-snapshot-health?staleAfterMinutes=bad',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_snapshot_health_invalid' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_stale_after_minutes');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_snapshot_health');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_stale_after_minutes');
});

test('phase900: ops snapshot health success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/opsSnapshotHealth');
  const repoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [repoPath]: {
      listSnapshots: async () => ([
        {
          id: 'ops_system_snapshot__global',
          snapshotType: 'ops_system_snapshot',
          snapshotKey: 'global',
          asOf: '2026-03-18T10:00:00.000Z',
          freshnessMinutes: 60,
          updatedAt: '2026-03-18T10:00:00.000Z'
        }
      ])
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleOpsSnapshotHealth } = require('../../src/routes/admin/opsSnapshotHealth');
    const res = createResCapture();
    await handleOpsSnapshotHealth({
      method: 'GET',
      url: '/api/admin/ops-snapshot-health?limit=10',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_snapshot_health_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_snapshot_health');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: dashboard kpi invalid fallbackMode emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osDashboardKpi');
  delete require.cache[routePath];
  const { handleDashboardKpi } = require('../../src/routes/admin/osDashboardKpi');
  const res = createResCapture();
  try {
    await handleDashboardKpi({
      method: 'GET',
      url: '/api/admin/os/dashboard-kpi?fallbackMode=reject',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_dashboard_invalid_fallback' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_fallback_mode');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_dashboard_kpi');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_fallback_mode');
});

test('phase900: dashboard kpi snapshot success emits completed_from_snapshot outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osDashboardKpi');
  const snapshotRepoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');

  await withModuleStubs({
    [snapshotRepoPath]: {
      getSnapshot: async () => ({
        asOf: new Date().toISOString(),
        freshnessMinutes: 60,
        data: {
          kpis: {
            registrations: { available: true, valueLabel: '1', series: [], note: '-' }
          }
        }
      }),
      saveSnapshot: async () => ({ ok: true })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleDashboardKpi } = require('../../src/routes/admin/osDashboardKpi');
    const res = createResCapture();
    await handleDashboardKpi({
      method: 'GET',
      url: '/api/admin/os/dashboard-kpi?windowMonths=1',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_dashboard_snapshot_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.source, 'snapshot');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed_from_snapshot');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_dashboard_kpi');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed_from_snapshot');
    delete require.cache[routePath];
  });
});

test('phase900: dashboard kpi required snapshot miss emits degraded not_available outcome metadata', async () => {
  const restoreEnv = withEnv({ OPS_SNAPSHOT_MODE: 'require' });
  const routePath = require.resolve('../../src/routes/admin/osDashboardKpi');
  const snapshotRepoPath = require.resolve('../../src/repos/firestore/opsSnapshotsRepo');

  await withModuleStubs({
    [snapshotRepoPath]: {
      getSnapshot: async () => null,
      saveSnapshot: async () => ({ ok: true })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleDashboardKpi } = require('../../src/routes/admin/osDashboardKpi');
    const res = createResCapture();
    try {
      await handleDashboardKpi({
        method: 'GET',
        url: '/api/admin/os/dashboard-kpi?windowMonths=1',
        headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_dashboard_snapshot_required' }
      }, res);
    } finally {
      restoreEnv();
      delete require.cache[routePath];
    }

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.dataSource, 'not_available');
    assert.equal(body.outcome && body.outcome.state, 'degraded');
    assert.equal(body.outcome && body.outcome.reason, 'not_available');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_dashboard_kpi');
    assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_available');
  });
});
