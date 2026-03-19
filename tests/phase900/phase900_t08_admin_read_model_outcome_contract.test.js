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

async function withModuleStubs(stubMap, callback) {
  const previous = new Map();
  Object.entries(stubMap || {}).forEach(([modulePath, exports]) => {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports
    };
  });
  try {
    return await callback();
  } finally {
    previous.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: read model invalid request emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/readModel');
  const usecasePath = require.resolve('../../src/usecases/admin/getNotificationReadModel');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const metricPath = require.resolve('../../src/ops/readPathLoadMetric');

  await withModuleStubs({
    [usecasePath]: {
      getNotificationReadModel: async () => {
        throw new Error('limit required');
      }
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T08_INVALID' }) },
    [metricPath]: { logReadPathLoadMetric: () => {} }
  }, async () => {
    delete require.cache[routePath];
    const { handleNotificationReadModel } = require('../../src/routes/admin/readModel');
    const res = createResCapture();
    await handleNotificationReadModel({
      method: 'GET',
      url: '/admin/read-model/notifications?limit=oops',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t08_invalid' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'limit required');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_request');
    assert.equal(body.outcome && body.outcome.routeType, 'admin_route');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.read_model');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_request');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: read model success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/readModel');
  const usecasePath = require.resolve('../../src/usecases/admin/getNotificationReadModel');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const metricPath = require.resolve('../../src/ops/readPathLoadMetric');

  await withModuleStubs({
    [usecasePath]: {
      getNotificationReadModel: async () => ([
        {
          notificationId: 'notification_1',
          title: 'Example',
          scenarioKey: 'scenario_a'
        }
      ])
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T08_SUCCESS' }) },
    [metricPath]: { logReadPathLoadMetric: () => {} }
  }, async () => {
    delete require.cache[routePath];
    const { handleNotificationReadModel } = require('../../src/routes/admin/readModel');
    const res = createResCapture();
    await handleNotificationReadModel({
      method: 'GET',
      url: '/admin/read-model/notifications?limit=5',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t08_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.read_model');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: read model internal error emits normalized error outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/readModel');
  const usecasePath = require.resolve('../../src/usecases/admin/getNotificationReadModel');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const metricPath = require.resolve('../../src/ops/readPathLoadMetric');

  await withModuleStubs({
    [usecasePath]: {
      getNotificationReadModel: async () => {
        throw new Error('boom');
      }
    },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T08_ERROR' }) },
    [metricPath]: { logReadPathLoadMetric: () => {} }
  }, async () => {
    delete require.cache[routePath];
    const { handleNotificationReadModel } = require('../../src/routes/admin/readModel');
    const res = createResCapture();
    await handleNotificationReadModel({
      method: 'GET',
      url: '/admin/read-model/notifications',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t08_error' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.read_model');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
