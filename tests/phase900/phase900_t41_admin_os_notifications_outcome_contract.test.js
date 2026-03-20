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

async function withOsNotificationsHandlers(overrides, run) {
  const createPath = require.resolve('../../src/usecases/notifications/createNotification');
  const approvePath = require.resolve('../../src/usecases/adminOs/approveNotification');
  const previewPath = require.resolve('../../src/usecases/adminOs/previewNotification');
  const sendPlanPath = require.resolve('../../src/usecases/adminOs/planNotificationSend');
  const sendExecutePath = require.resolve('../../src/usecases/adminOs/executeNotificationSend');
  const repoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const readPathMetricPath = require.resolve('../../src/ops/readPathLoadMetric');
  const guardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const routePath = require.resolve('../../src/routes/admin/osNotifications');

  const originalCreate = require.cache[createPath];
  const originalApprove = require.cache[approvePath];
  const originalPreview = require.cache[previewPath];
  const originalSendPlan = require.cache[sendPlanPath];
  const originalSendExecute = require.cache[sendExecutePath];
  const originalRepo = require.cache[repoPath];
  const originalAudit = require.cache[auditPath];
  const originalReadPathMetric = require.cache[readPathMetricPath];
  const originalGuard = require.cache[guardPath];
  const originalRoute = require.cache[routePath];

  require.cache[createPath] = {
    id: createPath,
    filename: createPath,
    loaded: true,
    exports: Object.assign({
      createNotification: async () => ({ id: 'notif_stub' })
    }, overrides && overrides.createNotification || {})
  };
  require.cache[approvePath] = {
    id: approvePath,
    filename: approvePath,
    loaded: true,
    exports: Object.assign({
      approveNotification: async () => ({ ok: true, status: 'active' })
    }, overrides && overrides.approveNotification || {})
  };
  require.cache[previewPath] = {
    id: previewPath,
    filename: previewPath,
    loaded: true,
    exports: Object.assign({
      previewNotification: async () => ({ ok: true, notificationId: 'notif_stub', trackEnabled: true })
    }, overrides && overrides.previewNotification || {})
  };
  require.cache[sendPlanPath] = {
    id: sendPlanPath,
    filename: sendPlanPath,
    loaded: true,
    exports: Object.assign({
      planNotificationSend: async () => ({ ok: true, planHash: 'plan_stub' })
    }, overrides && overrides.planNotificationSend || {})
  };
  require.cache[sendExecutePath] = {
    id: sendExecutePath,
    filename: sendExecutePath,
    loaded: true,
    exports: Object.assign({
      executeNotificationSend: async () => ({ ok: true, deliveredCount: 1, partial: false })
    }, overrides && overrides.executeNotificationSend || {})
  };
  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: Object.assign({
      listNotifications: async () => [],
      getNotification: async () => null,
      markNotificationsArchived: async () => ({ updatedCount: 0 })
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
  require.cache[readPathMetricPath] = {
    id: readPathMetricPath,
    filename: readPathMetricPath,
    loaded: true,
    exports: Object.assign({
      logReadPathLoadMetric: () => {}
    }, overrides && overrides.readPathLoadMetric || {})
  };
  require.cache[guardPath] = {
    id: guardPath,
    filename: guardPath,
    loaded: true,
    exports: Object.assign({
      enforceManagedFlowGuard: async () => ({
        ok: true,
        actor: 'phase900_actor',
        traceId: 'trace_phase900_os_notifications_guard'
      })
    }, overrides && overrides.managedFlowGuard || {})
  };
  delete require.cache[routePath];

  try {
    const handlers = require('../../src/routes/admin/osNotifications');
    await run(handlers);
  } finally {
    if (originalCreate) require.cache[createPath] = originalCreate;
    else delete require.cache[createPath];
    if (originalApprove) require.cache[approvePath] = originalApprove;
    else delete require.cache[approvePath];
    if (originalPreview) require.cache[previewPath] = originalPreview;
    else delete require.cache[previewPath];
    if (originalSendPlan) require.cache[sendPlanPath] = originalSendPlan;
    else delete require.cache[sendPlanPath];
    if (originalSendExecute) require.cache[sendExecutePath] = originalSendExecute;
    else delete require.cache[sendExecutePath];
    if (originalRepo) require.cache[repoPath] = originalRepo;
    else delete require.cache[repoPath];
    if (originalAudit) require.cache[auditPath] = originalAudit;
    else delete require.cache[auditPath];
    if (originalReadPathMetric) require.cache[readPathMetricPath] = originalReadPathMetric;
    else delete require.cache[readPathMetricPath];
    if (originalGuard) require.cache[guardPath] = originalGuard;
    else delete require.cache[guardPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: os notifications list success emits completed outcome metadata', async () => {
  await withOsNotificationsHandlers({
    notificationsRepo: {
      listNotifications: async () => ([
        { id: 'notif_phase900_1', title: 'A', body: 'B', ctaText: 'CTA', linkRegistryId: 'lr_1', status: 'draft' }
      ])
    }
  }, async ({ handleList }) => {
    const res = createResCapture();
    await handleList({
      method: 'GET',
      url: '/api/admin/os/notifications/list?limit=1',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_os_notifications_list',
        'x-request-id': 'req_phase900_os_notifications_list'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notifications_list');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: os notifications status missing notificationId emits normalized error outcome metadata', async () => {
  await withOsNotificationsHandlers({}, async ({ handleStatus }) => {
    const res = createResCapture();
    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/notifications/status',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_os_notifications_status_missing'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'notificationId required');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'notification_id_required');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notifications_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'notification_id_required');
  });
});

test('phase900: os notifications send execute partial emits partial outcome metadata', async () => {
  await withOsNotificationsHandlers({
    executeNotificationSend: {
      executeNotificationSend: async () => ({
        ok: false,
        partial: true,
        reason: 'send_partial_failure',
        deliveredCount: 3,
        failedCount: 1
      })
    }
  }, async ({ handleSendExecute }) => {
    const res = createResCapture();
    await handleSendExecute({
      method: 'POST',
      url: '/api/admin/os/notifications/send/execute',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_os_notifications_send_execute'
      }
    }, res, JSON.stringify({
      notificationId: 'notif_phase900_partial',
      planHash: 'plan_phase900',
      confirmToken: 'confirm_phase900'
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 207);
    assert.equal(body.ok, false);
    assert.equal(body.partial, true);
    assert.equal(body.reason, 'send_partial_failure');
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'send_partial_failure');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notifications_send_execute');
    assert.equal(res.result.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'send_partial_failure');
  });
});
