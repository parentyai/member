'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleNotificationFatigueWarning } = require('../../src/routes/admin/nextBestAction');

function createResCapture() {
  const result = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    result,
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers || null;
    },
    end(body) {
      result.body = body || '';
    }
  };
}

test('phase745: notification-fatigue-warning route requires x-actor header', async () => {
  const res = createResCapture();
  await handleNotificationFatigueWarning({
    method: 'GET',
    url: '/api/admin/os/notification-fatigue-warning?lineUserId=U745',
    headers: {}
  }, res);

  assert.equal(res.result.statusCode, 400);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'x-actor required');
});

test('phase745: notification-fatigue-warning route requires lineUserId query', async () => {
  const res = createResCapture();
  await handleNotificationFatigueWarning({
    method: 'GET',
    url: '/api/admin/os/notification-fatigue-warning',
    headers: {
      'x-actor': 'phase745_actor',
      'x-request-id': 'phase745_req_1',
      'x-trace-id': 'phase745_trace_1'
    }
  }, res, {
    appendAuditLog: async () => ({ id: 'audit_745_1' })
  });

  assert.equal(res.result.statusCode, 400);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.error, 'lineUserId required');
  assert.equal(payload.traceId, 'phase745_trace_1');
});

test('phase745: notification-fatigue-warning route returns disabled result and writes audit when flag is off', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  let auditPayload = null;
  try {
    const res = createResCapture();
    await handleNotificationFatigueWarning({
      method: 'GET',
      url: '/api/admin/os/notification-fatigue-warning?lineUserId=U745_DISABLED',
      headers: {
        'x-actor': 'phase745_actor',
        'x-request-id': 'phase745_req_2',
        'x-trace-id': 'phase745_trace_2'
      }
    }, res, {
      appendAuditLog: async (payload) => {
        auditPayload = payload;
        return { id: 'audit_745_2' };
      }
    });

    assert.equal(res.result.statusCode, 200, res.result.body);
    const payload = JSON.parse(res.result.body);
    assert.equal(payload.ok, true);
    assert.equal(payload.result.enabled, false);
    assert.equal(payload.result.fallbackReason, 'ENABLE_UXOS_FATIGUE_WARN_V1_off');
    assert.ok(auditPayload);
    assert.equal(auditPayload.action, 'uxos.notification_fatigue_warning.view');
    assert.equal(auditPayload.entityId, 'U745_DISABLED');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});

test('phase745: notification-fatigue-warning route is read-only and records audit with warn payload', async () => {
  const previous = process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
  process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = '1';
  let auditPayload = null;
  try {
    const res = createResCapture();
    await handleNotificationFatigueWarning({
      method: 'GET',
      url: '/api/admin/os/notification-fatigue-warning?lineUserId=U745_ENABLED&notificationCategory=SEQUENCE_GUIDANCE',
      headers: {
        'x-actor': 'phase745_actor',
        'x-request-id': 'phase745_req_3',
        'x-trace-id': 'phase745_trace_3'
      }
    }, res, {
      computeNotificationFatigueWarning: async () => ({
        lineUserId: 'U745_ENABLED',
        notificationCategory: 'SEQUENCE_GUIDANCE',
        sinceAt: '2026-03-07T00:00:00.000Z',
        deliveredToday: 2,
        projectedDeliveredToday: 3,
        threshold: 2,
        warn: true,
        reason: 'daily_notification_volume_high'
      }),
      appendAuditLog: async (payload) => {
        auditPayload = payload;
        return { id: 'audit_745_3' };
      }
    });

    assert.equal(res.result.statusCode, 200, res.result.body);
    const payload = JSON.parse(res.result.body);
    assert.equal(payload.ok, true);
    assert.equal(payload.result.enabled, true);
    assert.equal(payload.result.warning.warn, true);
    assert.equal(payload.result.warning.threshold, 2);
    assert.equal(payload.traceId, 'phase745_trace_3');
    assert.equal(payload.requestId, 'phase745_req_3');
    assert.ok(auditPayload);
    assert.equal(auditPayload.action, 'uxos.notification_fatigue_warning.view');
    assert.equal(auditPayload.traceId, 'phase745_trace_3');
    assert.equal(auditPayload.requestId, 'phase745_req_3');
    assert.equal(auditPayload.payloadSummary.warn, true);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_FATIGUE_WARN_V1;
    else process.env.ENABLE_UXOS_FATIGUE_WARN_V1 = previous;
  }
});
