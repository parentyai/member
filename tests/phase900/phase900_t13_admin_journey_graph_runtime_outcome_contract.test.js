'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest } = require('../../src/infra/firestore');
const {
  handleRuntime,
  handleRuntimeHistory
} = require('../../src/routes/admin/journeyGraphRuntime');

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
});

afterEach(() => {
  clearDbForTest();
});

test('phase900: journey graph runtime rejects missing lineUserId with outcome metadata', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/os/journey-graph/runtime',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jgr_missing' }
  };
  const res = createResCapture();
  await handleRuntime(req, res);

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'lineUserId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_runtime');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
});

test('phase900: journey graph runtime returns completed outcome metadata on success', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/os/journey-graph/runtime?lineUserId=U123&limit=5',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jgr_ok' }
  };
  const res = createResCapture();
  await handleRuntime(req, res, {
    journeyTodoItemsRepo: {
      listJourneyTodoItemsByLineUserId: async () => []
    },
    taskNodesRepo: {
      listTaskNodesByLineUserId: async () => []
    },
    journeyGraphCatalogRepo: {
      getJourneyGraphCatalog: async () => ({ enabled: false, schemaVersion: 1, edges: [] })
    },
    appendAuditLog: async () => {}
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.lineUserId, 'U123');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_runtime');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: journey graph runtime history returns completed outcome metadata', async () => {
  const req = {
    method: 'GET',
    url: '/api/admin/os/journey-graph/runtime/history?lineUserId=U123&limit=5',
    headers: { 'x-actor': 'tester', 'x-request-id': 'req_phase900_jgr_history' }
  };
  const res = createResCapture();
  await handleRuntimeHistory(req, res, {
    eventsRepo: {
      listEventsByUser: async () => []
    },
    appendAuditLog: async () => {}
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.lineUserId, 'U123');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_runtime_history');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});
