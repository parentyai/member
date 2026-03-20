'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { enforceManagedFlowGuard } = require('../../src/routes/admin/managedFlowGuard');

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

test('phase900: managed flow guard missing actionKey emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  const result = await enforceManagedFlowGuard({
    req: { headers: { 'x-actor': 'phase900_actor', 'x-trace-id': 'trace_phase900_guard_missing' } },
    res,
    actionKey: '',
    payload: {}
  });

  const body = res.readJson();
  assert.equal(result, null);
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'managed_flow_action_key_required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'managed_flow_action_key_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.managed_flow_guard');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'managed_flow_action_key_required');
});

test('phase900: managed flow guard missing trace emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  const result = await enforceManagedFlowGuard({
    req: { headers: { 'x-actor': 'phase900_actor' } },
    res,
    actionKey: 'notifications.approve',
    payload: { notificationId: 'n_phase900' }
  }, {
    appendAuditLog: async () => ({ id: 'audit_phase900_guard_trace_missing' })
  });

  const body = res.readJson();
  assert.equal(result, null);
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.error, 'x-trace-id required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'x_trace_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notifications.approve');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'x_trace_id_required');
});

test('phase900: managed flow guard missing actor emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  const result = await enforceManagedFlowGuard({
    req: { headers: { 'x-trace-id': 'trace_phase900_guard_actor_missing' } },
    res,
    actionKey: 'city_pack.bulletin.approve',
    payload: { bulletinId: 'bulletin_phase900' }
  }, {
    appendAuditLog: async () => ({ id: 'audit_phase900_guard_actor_missing' })
  });

  const body = res.readJson();
  assert.equal(result, null);
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.error, 'x-actor required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'x_actor_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack.bulletin.approve');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'x_actor_required');
});
