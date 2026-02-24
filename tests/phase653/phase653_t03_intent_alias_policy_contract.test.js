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
const opsConfigRepo = require('../../src/repos/firestore/opsConfigRepo');
const { resolveAllowedIntent } = require('../../src/usecases/billing/planGate');
const { evaluateLLMBudget, __testOnly } = require('../../src/usecases/billing/evaluateLlmBudget');
const { handlePlan } = require('../../src/routes/admin/llmPolicyConfig');

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

test('phase653: llm policy accepts next_action + per_user_daily_token_budget aliases and canonicalizes', async () => {
  const restoreEnv = withEnv({
    LLM_FEATURE_FLAG: 'true',
    OPS_CONFIRM_TOKEN_SECRET: 'phase653_alias_secret',
    ENABLE_INTENT_ALIAS_V1: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  __testOnly.globalRequestTimestamps.length = 0;

  try {
    await db.collection('system_flags').doc('phase0').set({ llmEnabled: true }, { merge: true });

    const normalized = opsConfigRepo.normalizeLlmPolicy({
      enabled: true,
      model: 'gpt-4o-mini',
      temperature: 0.2,
      top_p: 1,
      max_output_tokens: 600,
      per_user_daily_limit: 20,
      per_user_daily_token_budget: 12345,
      global_qps_limit: 5,
      cache_ttl_sec: 120,
      allowed_intents_free: ['faq_search'],
      allowed_intents_pro: ['next_action', 'risk_alert', 'faq_search'],
      safety_mode: 'strict'
    });
    assert.ok(normalized);
    assert.equal(normalized.per_user_token_budget, 12345);
    assert.ok(normalized.allowed_intents_pro.includes('next_action_generation'));
    assert.ok(!normalized.allowed_intents_pro.includes('next_action'));

    const allowed = await resolveAllowedIntent('pro', { policy: normalized });
    assert.ok(allowed.allowedIntents.includes('next_action_generation'));

    const gate = await evaluateLLMBudget('U_PHASE653_ALIAS', {
      intent: 'next_action',
      tokenEstimate: 10,
      planInfo: { plan: 'pro', status: 'active' },
      policy: normalized
    });
    assert.equal(gate.allowed, true);
    assert.equal(gate.intent, 'next_action_generation');

    const req = {
      headers: {
        'x-actor': 'phase653_test',
        'x-request-id': 'req_phase653_alias_plan',
        'x-trace-id': 'trace_phase653_alias_plan'
      },
      url: '/api/admin/llm/policy/plan'
    };
    const res = createResCapture();
    await handlePlan(req, res, JSON.stringify({
      policy: {
        enabled: true,
        allowed_intents_free: ['faq_search'],
        allowed_intents_pro: ['next_action', 'faq_search'],
        per_user_daily_token_budget: 9876
      }
    }));
    assert.equal(res.result.statusCode, 200);
    const body = res.readJson();
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.llmPolicy.allowed_intents_pro));
    assert.ok(body.llmPolicy.allowed_intents_pro.includes('next_action_generation'));
    assert.equal(body.llmPolicy.per_user_token_budget, 9876);
    assert.equal(body.canonicalization.intentAliasApplied, true);
    assert.equal(body.canonicalization.tokenBudgetAliasApplied, true);
  } finally {
    restoreEnv();
    __testOnly.globalRequestTimestamps.length = 0;
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
