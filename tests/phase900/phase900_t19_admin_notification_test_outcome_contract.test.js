'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleSendTest, handleTestRuns } = require('../../src/routes/admin/notificationTest');

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

test('phase900: send-test success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleSendTest({
    method: 'POST',
    url: '/api/admin/send-test',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_notification_test_trace_ok',
      'x-request-id': 'phase900_notification_test_req_ok'
    }
  }, res, JSON.stringify({
    notificationId: 'notif_001',
    mode: 'dry_run'
  }), {
    runNotificationTest: async () => ({
      ok: true,
      runId: 'run_001',
      summary: { total: 1, failed: 0 },
      results: [{ ok: true }]
    }),
    appendAuditLog: async () => ({ id: 'audit_send_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_send');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: send-test missing notificationId emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleSendTest({
    method: 'POST',
    url: '/api/admin/send-test',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({ mode: 'dry_run' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'notificationId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'notification_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_send');
});

test('phase900: send-test self_send without lineUserId emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleSendTest({
    method: 'POST',
    url: '/api/admin/send-test',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({
    notificationId: 'notif_002',
    mode: 'self_send'
  }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'lineUserId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_send');
});

test('phase900: send-test internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleSendTest({
    method: 'POST',
    url: '/api/admin/send-test',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({
    notificationId: 'notif_003',
    mode: 'dry_run'
  }), {
    runNotificationTest: async () => {
      throw new Error('boom');
    },
    appendAuditLog: async () => ({ id: 'audit_send_error' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_send');
});

test('phase900: test-runs success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleTestRuns({
    method: 'POST',
    url: '/api/admin/test-runs',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_notification_batch_trace_ok',
      'x-request-id': 'phase900_notification_batch_req_ok'
    }
  }, res, JSON.stringify({
    mode: 'dry_run',
    patterns: ['*']
  }), {
    runNotificationTest: async () => ({
      ok: true,
      runId: 'run_batch_001',
      summary: { total: 2, failed: 0 }
    }),
    appendAuditLog: async () => ({ id: 'audit_batch_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_runs');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: test-runs internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleTestRuns({
    method: 'POST',
    url: '/api/admin/test-runs',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({
    mode: 'dry_run',
    patterns: ['*']
  }), {
    runNotificationTest: async () => {
      throw new Error('boom');
    },
    appendAuditLog: async () => ({ id: 'audit_batch_error' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_test_runs');
});
