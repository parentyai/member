'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleUserBillingDetail } = require('../../src/routes/admin/osUserBillingDetail');

function createResCapture() {
  const out = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    writeHead(statusCode, headers) {
      out.statusCode = statusCode;
      out.headers = headers || null;
    },
    end(chunk) {
      if (chunk) out.body += String(chunk);
    },
    readJson() {
      return JSON.parse(out.body || '{}');
    },
    result: out
  };
}

test('phase652: os user billing detail returns 400 without lineUserId and returns merged billing+usage', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const missingReq = {
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_missing', 'x-trace-id': 'trace_missing' },
      url: '/api/admin/os/user-billing-detail'
    };
    const missingRes = createResCapture();
    await handleUserBillingDetail(missingReq, missingRes);
    assert.equal(missingRes.result.statusCode, 400);
    assert.equal(missingRes.readJson().error, 'lineUserId required');

    await db.collection('user_subscriptions').doc('U_BILL_1').set({
      lineUserId: 'U_BILL_1',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-12-31T00:00:00.000Z',
      stripeCustomerId: 'cus_bill_1',
      stripeSubscriptionId: 'sub_bill_1',
      lastEventId: 'evt_bill_1',
      updatedAt: '2026-02-24T00:00:00.000Z'
    }, { merge: true });
    await db.collection('llm_usage_stats').doc('U_BILL_1').set({
      lineUserId: 'U_BILL_1',
      usageCount: 9,
      totalTokensIn: 100,
      totalTokensOut: 300,
      totalTokenUsed: 400,
      blockedCount: 2,
      lastUsedAt: '2026-02-24T01:00:00.000Z',
      blockedHistory: [{ blockedReason: 'daily_limit_exceeded', createdAt: '2026-02-24T00:30:00.000Z' }]
    }, { merge: true });
    await db.collection('stripe_webhook_events').doc('evt_bill_1').set({
      eventType: 'customer.subscription.updated',
      status: 'processed',
      userId: 'U_BILL_1'
    }, { merge: true });

    const okReq = {
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_ok', 'x-trace-id': 'trace_ok' },
      url: '/api/admin/os/user-billing-detail?lineUserId=U_BILL_1'
    };
    const okRes = createResCapture();
    await handleUserBillingDetail(okReq, okRes);
    assert.equal(okRes.result.statusCode, 200);

    const body = okRes.readJson();
    assert.equal(body.ok, true);
    assert.equal(body.lineUserId, 'U_BILL_1');
    assert.equal(body.billing.plan, 'pro');
    assert.equal(body.billing.status, 'active');
    assert.equal(body.billing.lastEventId, 'evt_bill_1');
    assert.equal(body.llmUsage.usageCount, 9);
    assert.equal(body.llmUsage.totalTokenUsed, 400);
    assert.equal(body.lastStripeEvent.eventType, 'customer.subscription.updated');
    assert.equal(body.lastStripeEvent.status, 'processed');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
