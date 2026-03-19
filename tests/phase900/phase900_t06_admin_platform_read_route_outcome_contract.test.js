'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('phase900: legacy status success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/legacyStatus');
  delete require.cache[routePath];
  const { handleLegacyStatus } = require('../../src/routes/admin/legacyStatus');
  const res = createResCapture();
  try {
    await handleLegacyStatus({
      method: 'GET',
      url: '/api/admin/legacy-status',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t06_legacy' }
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
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.legacy_status');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: retention runs success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/retentionRuns');
  const repoPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [repoPath]: {
      listAuditLogs: async ({ action }) => ([
        {
          id: `${action}__1`,
          action,
          actor: 'tester',
          traceId: 'trace_phase900_t06_retention',
          requestId: 'request_phase900_t06_retention',
          createdAt: '2026-03-18T10:00:00.000Z',
          payloadSummary: {
            summary: { deletedCount: 3, collections: ['audit_logs'] },
            collections: ['audit_logs']
          }
        }
      ]),
      listAuditLogsByTraceId: async () => []
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T06_RETENTION' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleRetentionRuns } = require('../../src/routes/admin/retentionRuns');
    const res = createResCapture();
    await handleRetentionRuns({
      method: 'GET',
      url: '/api/admin/retention-runs?limit=5',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t06_retention' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.retention_runs');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: repo map missing artifact emits blocked outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/repoMap');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const previousExistsSync = fs.existsSync;
  const previousReadFileSync = fs.readFileSync;

  await withModuleStubs({
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T06_REPO_MAP' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleRepoMap } = require('../../src/routes/admin/repoMap');
    fs.existsSync = () => false;
    fs.readFileSync = () => {
      throw new Error('should_not_read');
    };
    const res = createResCapture();
    await handleRepoMap({
      method: 'GET',
      url: '/api/admin/repo-map',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t06_repo_map_missing' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 503);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'repo_map_not_generated');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.repo_map');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'repo_map_not_generated');
    delete require.cache[routePath];
  }).finally(() => {
    fs.existsSync = previousExistsSync;
    fs.readFileSync = previousReadFileSync;
  });
});

test('phase900: repo map success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/repoMap');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const previousExistsSync = fs.existsSync;
  const previousReadFileSync = fs.readFileSync;

  await withModuleStubs({
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T06_REPO_MAP_OK' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleRepoMap } = require('../../src/routes/admin/repoMap');
    fs.existsSync = () => true;
    fs.readFileSync = () => JSON.stringify({
      meta: { generatedAt: '2026-03-18T10:00:00.000Z', version: 1 },
      layers: [{ id: 'operator', items: [] }]
    });
    const res = createResCapture();
    await handleRepoMap({
      method: 'GET',
      url: '/api/admin/repo-map',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t06_repo_map_ok' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.generatedAt, '2026-03-18T10:00:00.000Z');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.repo_map');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  }).finally(() => {
    fs.existsSync = previousExistsSync;
    fs.readFileSync = previousReadFileSync;
  });
});
