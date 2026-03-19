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

test('phase900: os alerts summary success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osAlerts');
  const linkRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const notificationsRepoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const retryRepoPath = require.resolve('../../src/repos/firestore/sendRetryQueueRepo');
  const systemFlagsRepoPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const readModelPath = require.resolve('../../src/usecases/admin/getNotificationReadModel');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [linkRepoPath]: { listLinks: async () => ([{ id: 'warn_link_1' }]) },
    [notificationsRepoPath]: {
      listNotifications: async ({ status }) => {
        if (status === 'draft') return [{ id: 'draft_1' }];
        return [{ id: 'active_1', status: 'active', scheduledAt: new Date().toISOString() }];
      }
    },
    [retryRepoPath]: { listPending: async () => ([{ id: 'retry_1' }]) },
    [systemFlagsRepoPath]: { getKillSwitch: async () => true },
    [readModelPath]: {
      getNotificationReadModel: async () => ([{ notificationId: 'notification_1', targetCount: 0 }])
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T09_SUCCESS' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleAlertsSummary } = require('../../src/routes/admin/osAlerts');
    const res = createResCapture();
    await handleAlertsSummary({
      method: 'GET',
      url: '/api/admin/os/alerts/summary?limit=50',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t09_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.note, 'operational_actionable_only');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_alerts_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: os alerts summary internal error emits normalized error outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osAlerts');
  const linkRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const notificationsRepoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const retryRepoPath = require.resolve('../../src/repos/firestore/sendRetryQueueRepo');
  const systemFlagsRepoPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const readModelPath = require.resolve('../../src/usecases/admin/getNotificationReadModel');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [linkRepoPath]: { listLinks: async () => [] },
    [notificationsRepoPath]: { listNotifications: async () => [] },
    [retryRepoPath]: { listPending: async () => [] },
    [systemFlagsRepoPath]: {
      getKillSwitch: async () => {
        throw new Error('boom');
      }
    },
    [readModelPath]: { getNotificationReadModel: async () => [] },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T09_ERROR' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleAlertsSummary } = require('../../src/routes/admin/osAlerts');
    const res = createResCapture();
    await handleAlertsSummary({
      method: 'GET',
      url: '/api/admin/os/alerts/summary',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t09_error' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_alerts_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
