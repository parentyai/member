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

test('phase900: monitor insights invalid snapshotMode emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/monitorInsights');
  delete require.cache[routePath];
  const { handleMonitorInsights } = require('../../src/routes/admin/monitorInsights');
  const res = createResCapture();
  try {
    await handleMonitorInsights({
      method: 'GET',
      url: '/api/admin/monitor-insights?snapshotMode=invalid',
      headers: {}
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid snapshotMode');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_snapshot_mode');
  assert.equal(body.outcome && body.outcome.routeType, 'admin_route');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.monitor_insights');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_snapshot_mode');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: monitor insights blocked fallback emits degraded not_available outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/monitorInsights');
  const analyticsPath = require.resolve('../../src/repos/firestore/analyticsReadRepo');
  const notificationsPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const linksPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const snapshotsPath = require.resolve('../../src/repos/firestore/kpiSnapshotsReadRepo');
  const faqLogsPath = require.resolve('../../src/repos/firestore/faqAnswerLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [analyticsPath]: {
      listNotificationDeliveriesBySentAtRange: async () => ([])
    },
    [notificationsPath]: { getNotification: async () => null },
    [linksPath]: { getLink: async () => null },
    [snapshotsPath]: { listSnapshots: async () => ([]) },
    [faqLogsPath]: { listFaqAnswerLogs: async () => ([]) },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_MONITOR_NOT_AVAILABLE' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleMonitorInsights } = require('../../src/routes/admin/monitorInsights');
    const res = createResCapture();
    await handleMonitorInsights({
      method: 'GET',
      url: '/api/admin/monitor-insights?windowDays=7&fallbackMode=block&fallbackOnEmpty=false&readLimit=10',
      headers: { 'x-trace-id': 'trace_monitor_not_available' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.dataSource, 'not_available');
    assert.equal(body.fallbackBlocked, true);
    assert.equal(body.outcome && body.outcome.state, 'degraded');
    assert.equal(body.outcome && body.outcome.reason, 'not_available');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.monitor_insights');
    assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_available');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: monitor insights success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/monitorInsights');
  const analyticsPath = require.resolve('../../src/repos/firestore/analyticsReadRepo');
  const notificationsPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const linksPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const snapshotsPath = require.resolve('../../src/repos/firestore/kpiSnapshotsReadRepo');
  const faqLogsPath = require.resolve('../../src/repos/firestore/faqAnswerLogsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [analyticsPath]: {
      listNotificationDeliveriesBySentAtRange: async () => ([
        {
          id: 'delivery_1',
          data: {
            notificationId: 'notification_1',
            sentAt: '2026-03-18T10:00:00.000Z',
            clickAt: '2026-03-18T12:00:00.000Z'
          }
        }
      ])
    },
    [notificationsPath]: {
      getNotification: async () => ({
        id: 'notification_1',
        title: 'Monitor',
        scenarioKey: 'scenario_a',
        stepKey: 'welcome',
        linkRegistryId: 'link_1'
      })
    },
    [linksPath]: {
      getLink: async () => ({
        id: 'link_1',
        url: 'https://example.com/vendor',
        vendorKey: 'example_vendor',
        vendorLabel: 'Example Vendor'
      })
    },
    [snapshotsPath]: { listSnapshots: async () => ([]) },
    [faqLogsPath]: { listFaqAnswerLogs: async () => ([]) },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_MONITOR_SUCCESS' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleMonitorInsights } = require('../../src/routes/admin/monitorInsights');
    const res = createResCapture();
    await handleMonitorInsights({
      method: 'GET',
      url: '/api/admin/monitor-insights?windowDays=7&limit=5&readLimit=20',
      headers: { 'x-trace-id': 'trace_monitor_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.vendorCtrTop), true);
    assert.equal(Array.isArray(body.ctrTop), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.monitor_insights');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
