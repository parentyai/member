'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleNextBestAction, handleNotificationFatigueWarning } = require('../../src/routes/admin/nextBestAction');

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

test('phase900: next best action success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action?lineUserId=U900NBA',
    headers: {
      'x-actor': 'phase900_actor',
      'x-request-id': 'phase900_nba_req_ok',
      'x-trace-id': 'phase900_nba_trace_ok'
    }
  }, res, {
    getNextBestAction: async () => ({
      ok: true,
      enabled: true,
      authority: 'compute_next_tasks',
      lineUserId: 'U900NBA',
      nextBestAction: { taskId: 'task_phase900', title: 'Task phase900' },
      fallbackReason: null
    }),
    appendAuditLog: async () => ({ id: 'audit_phase900_nba_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_next_best_action');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: next best action missing lineUserId emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action',
    headers: {
      'x-actor': 'phase900_actor',
      'x-request-id': 'phase900_nba_req_missing',
      'x-trace-id': 'phase900_nba_trace_missing'
    }
  }, res, {
    appendAuditLog: async () => ({ id: 'audit_phase900_nba_missing' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'lineUserId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_next_best_action');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: next best action internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action?lineUserId=U900NBAERR',
    headers: {
      'x-actor': 'phase900_actor',
      'x-request-id': 'phase900_nba_req_error',
      'x-trace-id': 'phase900_nba_trace_error'
    }
  }, res, {
    getNextBestAction: async () => {
      throw new Error('boom');
    },
    appendAuditLog: async () => ({ id: 'audit_phase900_nba_error' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_next_best_action');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: notification fatigue warning disabled result emits blocked outcome metadata', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  try {
    const res = createResCapture();
    await handleNotificationFatigueWarning({
      method: 'GET',
      url: '/api/admin/os/notification-fatigue-warning?lineUserId=U900FATIGUE',
      headers: {
        'x-actor': 'phase900_actor',
        'x-request-id': 'phase900_fatigue_req_blocked',
        'x-trace-id': 'phase900_fatigue_trace_blocked'
      }
    }, res, {
      appendAuditLog: async () => ({ id: 'audit_phase900_fatigue_blocked' })
    });

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result && body.result.enabled, false);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'uxos_fatigue_warn_disabled');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notification_fatigue_warning');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'uxos_fatigue_warn_disabled');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});

test('phase900: notification fatigue warning success emits completed outcome metadata', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = '1';
  try {
    const res = createResCapture();
    await handleNotificationFatigueWarning({
      method: 'GET',
      url: '/api/admin/os/notification-fatigue-warning?lineUserId=U900FATIGUEOK&notificationCategory=SEQUENCE_GUIDANCE',
      headers: {
        'x-actor': 'phase900_actor',
        'x-request-id': 'phase900_fatigue_req_ok',
        'x-trace-id': 'phase900_fatigue_trace_ok'
      }
    }, res, {
      computeNotificationFatigueWarning: async () => ({
        lineUserId: 'U900FATIGUEOK',
        notificationCategory: 'SEQUENCE_GUIDANCE',
        sinceAt: '2026-03-19T00:00:00.000Z',
        deliveredToday: 2,
        projectedDeliveredToday: 3,
        threshold: 2,
        warn: true,
        reason: 'daily_notification_volume_high'
      }),
      appendAuditLog: async () => ({ id: 'audit_phase900_fatigue_ok' })
    });

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result && body.result.enabled, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notification_fatigue_warning');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});

test('phase900: notification fatigue warning internal error emits normalized error outcome metadata', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = '1';
  try {
    const res = createResCapture();
    await handleNotificationFatigueWarning({
      method: 'GET',
      url: '/api/admin/os/notification-fatigue-warning?lineUserId=U900FATIGUEERR',
      headers: {
        'x-actor': 'phase900_actor',
        'x-request-id': 'phase900_fatigue_req_error',
        'x-trace-id': 'phase900_fatigue_trace_error'
      }
    }, res, {
      computeNotificationFatigueWarning: async () => {
        throw new Error('boom');
      },
      appendAuditLog: async () => ({ id: 'audit_phase900_fatigue_error' })
    });

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_notification_fatigue_warning');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});
