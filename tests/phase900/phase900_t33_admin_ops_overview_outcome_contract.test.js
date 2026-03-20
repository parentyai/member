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

test('phase900: ops users summary success emits completed outcome metadata', async () => {
  const { handleUsersSummary } = require('../../src/routes/admin/opsOverview');
  const res = createResCapture();

  await handleUsersSummary({
    method: 'GET',
    url: '/api/admin/ops/users-summary?limit=10',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_users_success' }
  }, res, {
    getUserOperationalSummary: async () => ({
      items: [{ lineUserId: 'U1' }],
      meta: {
        dataSource: 'firestore',
        asOf: '2026-03-20T00:00:00.000Z',
        freshnessMinutes: 5,
        fallbackUsed: false,
        fallbackBlocked: false,
        fallbackSources: [],
        scannedCount: 1
      }
    }),
    appendAuditLog: async () => ({ ok: true }),
    logReadPathLoadMetric: () => {}
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_users_summary');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: ops users summary invalid fallbackMode preserves text body and emits error outcome headers', async () => {
  const { handleUsersSummary } = require('../../src/routes/admin/opsOverview');
  const res = createResCapture();

  await handleUsersSummary({
    method: 'GET',
    url: '/api/admin/ops/users-summary?fallbackMode=reject',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_users_invalid_fallback' }
  }, res, {
    logReadPathLoadMetric: () => {}
  });

  assert.equal(res.result.statusCode, 400);
  assert.equal(res.result.body, 'invalid fallbackMode');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_fallback_mode');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: ops notifications summary fallback success emits degraded outcome metadata', async () => {
  const { handleNotificationsSummary } = require('../../src/routes/admin/opsOverview');
  const res = createResCapture();

  await handleNotificationsSummary({
    method: 'GET',
    url: '/api/admin/ops/notifications-summary?status=queued',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_notifications_fallback' }
  }, res, {
    getNotificationOperationalSummary: async () => ({
      items: [{ notificationId: 'N1' }],
      meta: {
        dataSource: 'fallback',
        asOf: '2026-03-20T00:00:00.000Z',
        freshnessMinutes: 15,
        fallbackUsed: true,
        fallbackBlocked: false,
        fallbackSources: ['snapshot'],
        scannedCount: 1
      }
    }),
    appendAuditLog: async () => ({ ok: true }),
    logReadPathLoadMetric: () => {}
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'degraded');
  assert.equal(body.outcome && body.outcome.reason, 'completed_with_fallback');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.ops_notifications_summary');
  assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed_with_fallback');
});

test('phase900: ops notifications summary internal error preserves text body and emits error outcome headers', async () => {
  const { handleNotificationsSummary } = require('../../src/routes/admin/opsOverview');
  const res = createResCapture();

  await handleNotificationsSummary({
    method: 'GET',
    url: '/api/admin/ops/notifications-summary?limit=10',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_ops_notifications_error' }
  }, res, {
    getNotificationOperationalSummary: async () => {
      throw new Error('boom');
    },
    logReadPathLoadMetric: () => {}
  });

  assert.equal(res.result.statusCode, 500);
  assert.equal(res.result.body, 'error');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});
