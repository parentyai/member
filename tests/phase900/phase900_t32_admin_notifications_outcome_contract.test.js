'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  handleCreate,
  handleList,
  handleTestSend,
  handleSend
} = require('../../src/routes/admin/notifications');

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

function createHeaders(suffix) {
  return {
    'x-actor': 'phase900_notifications_actor',
    'x-request-id': `req_${suffix}`,
    'x-trace-id': `trace_${suffix}`
  };
}

test('phase900: notifications create success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCreate({
    method: 'POST',
    url: '/api/admin/notifications',
    headers: createHeaders('notifications_create')
  }, res, JSON.stringify({ title: 'Hello' }), {
    createNotification: async () => ({ id: 'notif_001' }),
    appendAuditLog: async () => ({ id: 'audit_001' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.id, 'notif_001');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notifications_create');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: notifications list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleList({
    method: 'GET',
    url: '/api/admin/notifications?limit=2&status=draft',
    headers: createHeaders('notifications_list')
  }, res, {
    listNotifications: async () => ([
      { id: 'notif_001', status: 'draft' },
      { id: 'notif_002', status: 'draft' }
    ])
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notifications_list');
});

test('phase900: notifications test-send missing lineUserId keeps text body and adds error outcome headers', async () => {
  const res = createResCapture();
  await handleTestSend({
    method: 'POST',
    url: '/api/admin/notifications/notif_001/test-send',
    headers: createHeaders('notifications_test_send_missing')
  }, res, JSON.stringify({ text: 'hello' }), 'notif_001');

  assert.equal(res.result.statusCode, 400);
  assert.equal(res.result.body, 'lineUserId required');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: notifications test-send kill switch keeps text body and adds blocked outcome headers', async () => {
  const res = createResCapture();
  await handleTestSend({
    method: 'POST',
    url: '/api/admin/notifications/notif_001/test-send',
    headers: createHeaders('notifications_test_send_blocked')
  }, res, JSON.stringify({
    lineUserId: 'user_001',
    text: 'hello'
  }), 'notif_001', {
    getKillSwitch: async () => ({ notificationTest: true }),
    testSendNotification: async () => {
      throw new Error('kill switch on');
    }
  });

  assert.equal(res.result.statusCode, 403);
  assert.equal(res.result.body, 'kill switch on');
  assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'kill_switch_on');
});

test('phase900: notifications send partial failure emits degraded outcome metadata', async () => {
  const res = createResCapture();
  await handleSend({
    method: 'POST',
    url: '/api/admin/notifications/notif_001/send',
    headers: createHeaders('notifications_send_partial')
  }, res, JSON.stringify({ sentAt: '2026-03-19T00:00:00.000Z' }), 'notif_001', {
    getKillSwitch: async () => ({ notificationSend: false }),
    sendNotification: async () => ({
      deliveredCount: 3,
      skippedCount: 1,
      failedCount: 1,
      sendSummary: {
        partialFailure: true
      }
    }),
    appendAuditLog: async () => ({ id: 'audit_send_partial' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 207);
  assert.equal(body.ok, false);
  assert.equal(body.partial, true);
  assert.equal(body.outcome && body.outcome.state, 'degraded');
  assert.equal(body.outcome && body.outcome.reason, 'send_partial_failure');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notifications_send');
  assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'send_partial_failure');
});
