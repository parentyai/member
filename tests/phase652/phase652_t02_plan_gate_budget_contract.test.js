'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest
} = require('../../src/infra/firestore');
const { resolvePlan, resolveAllowedIntent } = require('../../src/usecases/billing/planGate');
const { evaluateLLMBudget, __testOnly } = require('../../src/usecases/billing/evaluateLlmBudget');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase652: resolvePlan treats active/trialing as pro and past_due as free', async () => {
  const db = createDbStub();
  setDbForTest(db);

  try {
    await db.collection('user_subscriptions').doc('U_PRO').set({
      lineUserId: 'U_PRO',
      plan: 'pro',
      status: 'active'
    }, { merge: true });
    await db.collection('user_subscriptions').doc('U_PAST').set({
      lineUserId: 'U_PAST',
      plan: 'pro',
      status: 'past_due'
    }, { merge: true });

    const pro = await resolvePlan('U_PRO');
    const pastDue = await resolvePlan('U_PAST');
    const missing = await resolvePlan('U_MISSING');

    assert.equal(pro.plan, 'pro');
    assert.equal(pro.status, 'active');
    assert.equal(pastDue.plan, 'free');
    assert.equal(pastDue.status, 'past_due');
    assert.equal(missing.plan, 'free');
    assert.equal(missing.status, 'unknown');

    const allowed = await resolveAllowedIntent('pro', {
      policy: {
        allowed_intents_free: ['faq_search'],
        allowed_intents_pro: ['risk_alert', 'faq_search']
      }
    });
    assert.deepEqual(allowed.allowedIntents, ['risk_alert', 'faq_search']);
  } finally {
    clearDbForTest();
  }
});

test('phase652: evaluateLLMBudget enforces daily/token/global limits and free downgrade', async () => {
  const restoreEnv = withEnv({ LLM_FEATURE_FLAG: 'true' });
  const db = createDbStub();
  setDbForTest(db);
  __testOnly.globalRequestTimestamps.length = 0;

  try {
    await db.collection('system_flags').doc('phase0').set({ llmEnabled: true }, { merge: true });
    await db.collection('llm_usage_stats').doc('U_LIMIT').set({
      lineUserId: 'U_LIMIT',
      dailyUsageCount: 2,
      dailyTokenUsed: 145
    }, { merge: true });

    const policy = {
      enabled: true,
      model: 'gpt-4o-mini',
      per_user_daily_limit: 2,
      per_user_token_budget: 150,
      global_qps_limit: 10,
      allowed_intents_free: ['faq_search', 'risk_alert'],
      allowed_intents_pro: ['faq_search', 'risk_alert']
    };

    const dailyBlocked = await evaluateLLMBudget('U_LIMIT', {
      intent: 'risk_alert',
      tokenEstimate: 1,
      planInfo: { plan: 'pro', status: 'active' },
      policy
    });
    assert.equal(dailyBlocked.allowed, false);
    assert.equal(dailyBlocked.blockedReason, 'daily_limit_exceeded');

    await db.collection('llm_usage_stats').doc('U_TOKEN').set({
      lineUserId: 'U_TOKEN',
      dailyUsageCount: 0,
      dailyTokenUsed: 149
    }, { merge: true });
    const tokenBlocked = await evaluateLLMBudget('U_TOKEN', {
      intent: 'risk_alert',
      tokenEstimate: 5,
      planInfo: { plan: 'pro', status: 'active' },
      policy: Object.assign({}, policy, { per_user_daily_limit: 10 })
    });
    assert.equal(tokenBlocked.allowed, false);
    assert.equal(tokenBlocked.blockedReason, 'token_budget_exceeded');

    __testOnly.globalRequestTimestamps.length = 0;
    const qpsPolicy = Object.assign({}, policy, {
      per_user_daily_limit: 10,
      per_user_token_budget: 10000,
      global_qps_limit: 1
    });
    const allowOnce = await evaluateLLMBudget('U_QPS', {
      intent: 'risk_alert',
      tokenEstimate: 0,
      planInfo: { plan: 'pro', status: 'active' },
      policy: qpsPolicy
    });
    const blockedTwice = await evaluateLLMBudget('U_QPS', {
      intent: 'risk_alert',
      tokenEstimate: 0,
      planInfo: { plan: 'pro', status: 'active' },
      policy: qpsPolicy
    });
    assert.equal(allowOnce.allowed, true);
    assert.equal(blockedTwice.allowed, false);
    assert.equal(blockedTwice.blockedReason, 'global_qps_exceeded');

    const downgraded = await evaluateLLMBudget('U_FREE', {
      intent: 'risk_alert',
      tokenEstimate: 0,
      planInfo: { plan: 'free', status: 'past_due' },
      policy
    });
    assert.equal(downgraded.allowed, false);
    assert.equal(downgraded.blockedReason, 'plan_free');
  } finally {
    restoreEnv();
    __testOnly.globalRequestTimestamps.length = 0;
    clearDbForTest();
  }
});
