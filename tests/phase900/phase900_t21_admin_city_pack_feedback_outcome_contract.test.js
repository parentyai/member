'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCityPackFeedback } = require('../../src/routes/admin/cityPackFeedback');

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

test('phase900: city pack feedback list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'GET',
    url: '/api/admin/city-pack-feedback?limit=5',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_feedback_list_trace_ok',
      'x-request-id': 'phase900_feedback_list_req_ok'
    }
  }, res, '', {
    listFeedback: async () => ([{
      id: 'cpf_001',
      status: 'new',
      feedbackText: 'feedback',
      createdAt: '2026-03-19T00:00:00.000Z',
      updatedAt: '2026-03-19T00:00:00.000Z'
    }]),
    appendAuditLog: async () => ({ id: 'audit_feedback_list_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: city pack feedback detail missing record emits not_found outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'GET',
    url: '/api/admin/city-pack-feedback/cpf_missing',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '', {
    getFeedback: async () => null
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'feedback not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'feedback_not_found');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_detail');
});

test('phase900: city pack feedback action kill switch emits blocked outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'POST',
    url: '/api/admin/city-pack-feedback/cpf_002/triage',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_feedback_blocked_trace',
      'x-request-id': 'phase900_feedback_blocked_req'
    }
  }, res, JSON.stringify({}), {
    getFeedback: async () => ({ id: 'cpf_002', regionKey: 'tokyo' }),
    getKillSwitch: async () => true,
    appendAuditLog: async () => ({ id: 'audit_feedback_blocked' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 409);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'kill switch on');
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'kill_switch_on');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_action');
  assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'kill_switch_on');
});

test('phase900: city pack feedback action success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'POST',
    url: '/api/admin/city-pack-feedback/cpf_003/resolve',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_feedback_action_trace_ok',
      'x-request-id': 'phase900_feedback_action_req_ok'
    }
  }, res, JSON.stringify({ resolution: 'manual_fix' }), {
    getFeedback: async () => ({
      id: 'cpf_003',
      resolution: null,
      resolvedAt: null,
      regionKey: 'osaka',
      slotKey: 'slot_1',
      packClass: 'regional',
      language: 'ja'
    }),
    getKillSwitch: async () => false,
    updateFeedback: async () => undefined,
    appendAuditLog: async () => ({ id: 'audit_feedback_action_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.feedbackId, 'cpf_003');
  assert.equal(body.status, 'resolved');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_action');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: city pack feedback action method mismatch emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'GET',
    url: '/api/admin/city-pack-feedback/cpf_004/triage',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 405);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'method not allowed');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'method_not_allowed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_action');
});

test('phase900: city pack feedback list internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackFeedback({
    method: 'GET',
    url: '/api/admin/city-pack-feedback',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_feedback_error_trace',
      'x-request-id': 'phase900_feedback_error_req'
    }
  }, res, '', {
    listFeedback: async () => {
      throw new Error('boom');
    }
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_feedback_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
});
