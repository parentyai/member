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

test('phase900: os user billing detail missing lineUserId emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUserBillingDetail');
  delete require.cache[routePath];
  const { handleUserBillingDetail } = require('../../src/routes/admin/osUserBillingDetail');
  const res = createResCapture();

  await handleUserBillingDetail({
    method: 'GET',
    url: '/api/admin/os/user-billing-detail',
    headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t11_missing' }
  }, res);

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'lineUserId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_user_billing_detail');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  delete require.cache[routePath];
});

test('phase900: os user billing detail success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUserBillingDetail');
  const subscriptionPath = require.resolve('../../src/repos/firestore/userSubscriptionsRepo');
  const usagePath = require.resolve('../../src/repos/firestore/llmUsageStatsRepo');
  const stripePath = require.resolve('../../src/repos/firestore/stripeWebhookEventsRepo');
  const journeyProfilePath = require.resolve('../../src/repos/firestore/userJourneyProfilesRepo');
  const journeySchedulePath = require.resolve('../../src/repos/firestore/userJourneySchedulesRepo');
  const journeyStatsPath = require.resolve('../../src/repos/firestore/journeyTodoStatsRepo');
  const journeyItemsPath = require.resolve('../../src/repos/firestore/journeyTodoItemsRepo');

  await withModuleStubs({
    [subscriptionPath]: {
      getUserSubscription: async () => ({
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-12-31T00:00:00.000Z',
        updatedAt: '2026-02-24T00:00:00.000Z',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        lastEventId: 'evt_1'
      })
    },
    [usagePath]: {
      getUserUsageStats: async () => ({
        usageCount: 9,
        totalTokensIn: 100,
        totalTokensOut: 300,
        totalTokenUsed: 400,
        blockedCount: 2,
        lastUsedAt: '2026-02-24T01:00:00.000Z',
        blockedHistory: []
      })
    },
    [stripePath]: {
      getStripeWebhookEvent: async () => ({ eventType: 'customer.subscription.updated', status: 'processed' })
    },
    [journeyProfilePath]: { getUserJourneyProfile: async () => null },
    [journeySchedulePath]: { getUserJourneySchedule: async () => null },
    [journeyStatsPath]: { getUserJourneyTodoStats: async () => null },
    [journeyItemsPath]: { listJourneyTodoItemsByLineUserId: async () => [] }
  }, async () => {
    delete require.cache[routePath];
    const { handleUserBillingDetail } = require('../../src/routes/admin/osUserBillingDetail');
    const res = createResCapture();
    await handleUserBillingDetail({
      method: 'GET',
      url: '/api/admin/os/user-billing-detail?lineUserId=U_BILL_1',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t11_success', 'x-request-id': 'req_phase900_t11_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.lineUserId, 'U_BILL_1');
    assert.equal(body.billing.plan, 'pro');
    assert.equal(body.llmUsage.totalTokenUsed, 400);
    assert.equal(body.lastStripeEvent.eventType, 'customer.subscription.updated');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_user_billing_detail');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: os user billing detail internal error emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osUserBillingDetail');
  const subscriptionPath = require.resolve('../../src/repos/firestore/userSubscriptionsRepo');
  const usagePath = require.resolve('../../src/repos/firestore/llmUsageStatsRepo');
  const stripePath = require.resolve('../../src/repos/firestore/stripeWebhookEventsRepo');
  const journeyProfilePath = require.resolve('../../src/repos/firestore/userJourneyProfilesRepo');
  const journeySchedulePath = require.resolve('../../src/repos/firestore/userJourneySchedulesRepo');
  const journeyStatsPath = require.resolve('../../src/repos/firestore/journeyTodoStatsRepo');
  const journeyItemsPath = require.resolve('../../src/repos/firestore/journeyTodoItemsRepo');

  await withModuleStubs({
    [subscriptionPath]: {
      getUserSubscription: async () => {
        throw new Error('boom');
      }
    },
    [usagePath]: { getUserUsageStats: async () => ({}) },
    [stripePath]: { getStripeWebhookEvent: async () => null },
    [journeyProfilePath]: { getUserJourneyProfile: async () => null },
    [journeySchedulePath]: { getUserJourneySchedule: async () => null },
    [journeyStatsPath]: { getUserJourneyTodoStats: async () => null },
    [journeyItemsPath]: { listJourneyTodoItemsByLineUserId: async () => [] }
  }, async () => {
    delete require.cache[routePath];
    const { handleUserBillingDetail } = require('../../src/routes/admin/osUserBillingDetail');
    const res = createResCapture();
    await handleUserBillingDetail({
      method: 'GET',
      url: '/api/admin/os/user-billing-detail?lineUserId=U_BILL_1',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_phase900_t11_error' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_user_billing_detail');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});
