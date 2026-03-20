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

async function withOsNotificationSeedHandlers(overrides, run) {
  const repoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const osContextPath = require.resolve('../../src/routes/admin/osContext');
  const routePath = require.resolve('../../src/routes/admin/osNotificationSeed');

  const originalRepo = require.cache[repoPath];
  const originalAudit = require.cache[auditPath];
  const originalOsContext = require.cache[osContextPath];
  const originalRoute = require.cache[routePath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: Object.assign({
      listNotificationsBySeedTag: async () => ([
        { id: 'notif_seed_active', seedArchivedAt: null },
        { id: 'notif_seed_archived', seedArchivedAt: '2026-03-01T00:00:00.000Z' }
      ]),
      markNotificationsSeedArchived: async () => ({ updatedCount: 1 })
    }, overrides && overrides.notificationsRepo || {})
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_stub' })
    }, overrides && overrides.appendAuditLog || {})
  };

  require.cache[osContextPath] = {
    id: osContextPath,
    filename: osContextPath,
    loaded: true,
    exports: Object.assign({
      resolveRequestId: () => 'req_phase900_t51',
      resolveTraceId: () => 'trace_phase900_t51',
      logRouteError: () => {}
    }, overrides && overrides.osContext || {})
  };

  delete require.cache[routePath];
  try {
    const handlers = require('../../src/routes/admin/osNotificationSeed');
    await run(handlers);
  } finally {
    if (originalRepo) require.cache[repoPath] = originalRepo;
    else delete require.cache[repoPath];
    if (originalAudit) require.cache[auditPath] = originalAudit;
    else delete require.cache[auditPath];
    if (originalOsContext) require.cache[osContextPath] = originalOsContext;
    else delete require.cache[osContextPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: os notification seed archive partial emits routeKey and outcome headers', async () => {
  await withOsNotificationSeedHandlers({}, async ({ handleSeedArchive }) => {
    const res = createResCapture();
    await handleSeedArchive({
      method: 'POST',
      url: '/api/admin/os/notifications/seed/archive',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t51_archive'
      }
    }, res, JSON.stringify({
      seedTag: 'dummy',
      seedRunId: 'run_phase900_t51',
      reason: 'phase900 verification',
      limit: 20
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.matchedCount, 2);
    assert.equal(body.archivedCount, 1);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_skips');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_notification_seed');
    assert.equal(res.result.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed_with_skips');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: os notification seed archive invalid limit emits normalized error outcome', async () => {
  await withOsNotificationSeedHandlers({}, async ({ handleSeedArchive }) => {
    const res = createResCapture();
    await handleSeedArchive({
      method: 'POST',
      url: '/api/admin/os/notifications/seed/archive',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t51_invalid_limit'
      }
    }, res, JSON.stringify({
      seedTag: 'dummy',
      limit: 0
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'limit invalid');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_limit');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin_os_notification_seed');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_limit');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
