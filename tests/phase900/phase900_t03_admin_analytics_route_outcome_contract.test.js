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

test('phase900: users summary analyze invalid quickFilter emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUsersSummaryAnalyze');
  delete require.cache[routePath];
  const { handleUsersSummaryAnalyze } = require('../../src/routes/admin/osUsersSummaryAnalyze');
  const res = createResCapture();
  try {
    await handleUsersSummaryAnalyze({
      method: 'GET',
      url: '/api/admin/os/users-summary/analyze?quickFilter=bad',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_users_analyze_invalid' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_quick_filter');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_users_summary_analyze');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_quick_filter');
});

test('phase900: users summary analyze success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUsersSummaryAnalyze');
  const usecasePath = require.resolve('../../src/usecases/phase5/getUsersSummaryFiltered');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [usecasePath]: { getUsersSummaryFiltered: async () => ([
      {
        lineUserId: 'U1',
        plan: 'pro',
        subscriptionStatus: 'active',
        billingIntegrityState: 'ok',
        todoProgressRate: 0.5,
        dependencyBlockRate: 0.25,
        localGuidanceCoverage: 0.75
      }
    ]) },
    [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_USERS' }) }
  }, async () => {
    delete require.cache[routePath];
    const { handleUsersSummaryAnalyze } = require('../../src/routes/admin/osUsersSummaryAnalyze');
    const res = createResCapture();
    await handleUsersSummaryAnalyze({
      method: 'GET',
      url: '/api/admin/os/users-summary/analyze?limit=10',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_users_analyze_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.analyze.total, 1);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_users_summary_analyze');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: llm usage summary invalid query emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLlmUsageSummary');
  delete require.cache[routePath];
  const { handleLlmUsageSummary } = require('../../src/routes/admin/osLlmUsageSummary');
  const res = createResCapture();
  try {
    await handleLlmUsageSummary({
      method: 'GET',
      url: '/api/admin/os/llm-usage/summary?limit=bad',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_llm_usage_invalid' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_query');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_llm_usage_summary');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_query');
});

test('phase900: llm usage summary success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLlmUsageSummary');
  const usagePath = require.resolve('../../src/repos/firestore/llmUsageLogsRepo');
  const actionPath = require.resolve('../../src/repos/firestore/llmActionLogsRepo');
  const faqPath = require.resolve('../../src/repos/firestore/faqAnswerLogsRepo');
  const auditRepoPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const auditUsecasePath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const traceProbePath = require.resolve('../../src/usecases/admin/buildTraceProbeRows');

  await withModuleStubs({
    [usagePath]: { listLlmUsageLogsByCreatedAtRange: async () => ([]) },
    [actionPath]: { listLlmActionLogsByCreatedAtRange: async () => ([]) },
    [faqPath]: { listFaqAnswerLogsByCreatedAtRange: async () => ([]) },
    [auditRepoPath]: { listAuditLogs: async () => ([]) },
    [auditUsecasePath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_LLM' }) },
    [traceProbePath]: { buildTraceProbeRows: async () => ([]) }
  }, async () => {
    delete require.cache[routePath];
    const { handleLlmUsageSummary } = require('../../src/routes/admin/osLlmUsageSummary');
    const res = createResCapture();
    await handleLlmUsageSummary({
      method: 'GET',
      url: '/api/admin/os/llm-usage/summary?windowDays=7&limit=20',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_llm_usage_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.ok(body.summary);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_llm_usage_summary');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: notification deliveries missing query emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/notificationDeliveries');
  const usecasePath = require.resolve('../../src/usecases/deliveries/getNotificationDeliveries');

  await withModuleStubs({
    [usecasePath]: {
      getNotificationDeliveries: async () => {
        const err = new Error('lineUserId or memberId required');
        err.statusCode = 400;
        throw err;
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleNotificationDeliveries } = require('../../src/routes/admin/notificationDeliveries');
    const res = createResCapture();
    await handleNotificationDeliveries({
      method: 'GET',
      url: '/api/admin/notification-deliveries',
      headers: { 'x-trace-id': 'trace_notification_deliveries_invalid' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'line_user_id_or_member_id_required');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_deliveries');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_or_member_id_required');
    delete require.cache[routePath];
  });
});

test('phase900: notification deliveries success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/notificationDeliveries');
  const usecasePath = require.resolve('../../src/usecases/deliveries/getNotificationDeliveries');

  await withModuleStubs({
    [usecasePath]: {
      getNotificationDeliveries: async () => ({
        ok: true,
        serverTime: '2026-03-19T00:00:00.000Z',
        query: { lineUserId: 'U1', memberId: null, memberNumber: null, resolvedLineUserIds: ['U1'] },
        items: [],
        summary: { total: 0, danger: 0, warn: 0, ok: 0, unknown: 0 }
      })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleNotificationDeliveries } = require('../../src/routes/admin/notificationDeliveries');
    const res = createResCapture();
    await handleNotificationDeliveries({
      method: 'GET',
      url: '/api/admin/notification-deliveries?lineUserId=U1',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_notification_deliveries_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.notification_deliveries');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});
