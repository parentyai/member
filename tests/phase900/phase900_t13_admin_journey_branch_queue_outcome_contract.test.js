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

test('phase900: journey branch queue success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/journeyGraphBranchQueue');
  const queuePath = require.resolve('../../src/repos/firestore/journeyBranchQueueRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [queuePath]: {
      listJourneyBranchItems: async () => [{
        id: 'jbq_1',
        status: 'pending',
        lineUserId: 'U_1',
        deliveryId: 'delivery_1',
        ruleId: 'rule_1',
        nextAttemptAt: '2026-03-19T00:00:00.000Z',
        branchDispatchStatus: 'queued'
      }]
    },
    [auditPath]: {
      appendAuditLog: async () => {}
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleStatus } = require('../../src/routes/admin/journeyGraphBranchQueue');
    const res = createResCapture();

    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/journey-graph/branch-queue/status?limit=10&status=pending&lineUserId=U_1',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_t13_success',
        'x-request-id': 'req_phase900_t13_success'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.limit, 10);
    assert.equal(body.status, 'pending');
    assert.equal(body.lineUserId, 'U_1');
    assert.deepEqual(body.summary, {
      total: 1,
      pending: 1,
      sent: 0,
      failed: 0,
      skipped: 0
    });
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.items.length, 1);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_branch_queue_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: journey branch queue list fallback preserves completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/journeyGraphBranchQueue');
  const queuePath = require.resolve('../../src/repos/firestore/journeyBranchQueueRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [queuePath]: {
      listJourneyBranchItems: async () => {
        throw new Error('firestore unavailable');
      }
    },
    [auditPath]: {
      appendAuditLog: async () => {}
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleStatus } = require('../../src/routes/admin/journeyGraphBranchQueue');
    const res = createResCapture();

    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/journey-graph/branch-queue/status?status=failed',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t13_fallback' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, 'failed');
    assert.equal(body.lineUserId, null);
    assert.deepEqual(body.summary, {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    });
    assert.deepEqual(body.items, []);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_branch_queue_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: journey branch queue audit error emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/journeyGraphBranchQueue');
  const queuePath = require.resolve('../../src/repos/firestore/journeyBranchQueueRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [queuePath]: {
      listJourneyBranchItems: async () => []
    },
    [auditPath]: {
      appendAuditLog: async () => {
        throw new Error('boom');
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleStatus } = require('../../src/routes/admin/journeyGraphBranchQueue');
    const res = createResCapture();

    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/journey-graph/branch-queue/status',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t13_error' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_graph_branch_queue_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
