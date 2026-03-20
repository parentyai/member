'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const {
  handleStatus,
  handlePlan,
  handleSet,
  handleHistory
} = require('../../src/routes/admin/journeyGraphCatalogConfig');

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

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase900: journey graph catalog status returns completed outcome metadata', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/os/journey-graph/status',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_status' }
  };
  const res = createResCapture();
  await handleStatus(req, res);

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_status');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: journey graph catalog plan rejects invalid catalog with outcome metadata', async () => {
  const req = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/plan',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_plan_invalid' }
  };
  const res = createResCapture();
  await handlePlan(req, res, JSON.stringify({ catalog: { enabled: 'bad' } }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid journeyGraphCatalog');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_journey_graph_catalog');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_journey_graph_catalog');
});

test('phase900: journey graph catalog set reports blocked outcome on plan hash mismatch', async () => {
  const planReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/plan',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_plan' }
  };
  const planRes = createResCapture();
  await handlePlan(planReq, planRes, JSON.stringify({ catalog: { enabled: true } }));
  const planned = planRes.readJson();

  const setReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/set',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_set_mismatch' }
  };
  const setRes = createResCapture();
  await handleSet(setReq, setRes, JSON.stringify({
    catalog: planned.journeyGraphCatalog,
    planHash: 'journeygraph_bad_hash',
    confirmToken: planned.confirmToken
  }));

  const body = setRes.readJson();
  assert.equal(setRes.result.statusCode, 409);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'plan_hash_mismatch');
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'plan_hash_mismatch');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-state'], 'blocked');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-reason'], 'plan_hash_mismatch');
});

test('phase900: journey graph catalog set reports blocked outcome on confirm token mismatch', async () => {
  const planReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/plan',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_plan_confirm' }
  };
  const planRes = createResCapture();
  await handlePlan(planReq, planRes, JSON.stringify({ catalog: { enabled: true } }));
  const planned = planRes.readJson();

  const setReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/set',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_set_confirm' }
  };
  const setRes = createResCapture();
  await handleSet(setReq, setRes, JSON.stringify({
    catalog: planned.journeyGraphCatalog,
    planHash: planned.planHash,
    confirmToken: 'bad-token'
  }));

  const body = setRes.readJson();
  assert.equal(setRes.result.statusCode, 409);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'confirm_token_mismatch');
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'confirm_token_mismatch');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-state'], 'blocked');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-reason'], 'confirm_token_mismatch');
});

test('phase900: journey graph catalog set returns completed outcome on success', async () => {
  const planReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/plan',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_plan_ok' }
  };
  const planRes = createResCapture();
  await handlePlan(planReq, planRes, JSON.stringify({ catalog: { enabled: true } }));
  const planned = planRes.readJson();

  const setReq = {
    method: 'POST',
    url: '/api/admin/os/journey-graph/set',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_set_ok' }
  };
  const setRes = createResCapture();
  await handleSet(setReq, setRes, JSON.stringify({
    catalog: planned.journeyGraphCatalog,
    planHash: planned.planHash,
    confirmToken: planned.confirmToken
  }));

  const body = setRes.readJson();
  assert.equal(setRes.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_set');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-state'], 'success');
  assert.equal(resOrEmpty(setRes).headers['x-member-outcome-reason'], 'completed');
});

test('phase900: journey graph catalog history returns completed outcome metadata', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/os/journey-graph/history?limit=5',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jg_history' }
  };
  const res = createResCapture();
  await handleHistory(req, res);

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_history');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

function resOrEmpty(res) {
  return res && res.result ? res.result : { headers: {} };
}
