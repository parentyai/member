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
const { handlePlan, handleSet, handleHistory } = require('../../src/routes/admin/llmPolicyConfig');

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
  const result = { statusCode: null, headers: null, body: '' };
  return {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers || null;
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    json() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

test('phase654: llm policy plan/set accepts alias keys and exposes history endpoint', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase654_confirm_secret',
    ENABLE_INTENT_ALIAS_V1: '1'
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const reqBase = {
      headers: {
        'x-actor': 'phase654_test',
        'x-request-id': 'req_phase654_policy',
        'x-trace-id': 'trace_phase654_policy'
      }
    };

    const planRes = createResCapture();
    await handlePlan(
      Object.assign({ url: '/api/admin/llm/policy/plan' }, reqBase),
      planRes,
      JSON.stringify({
        policy: {
          enabled: true,
          temperature: 0.3,
          max_tokens: 700,
          per_user_limit: 33,
          rate_limit: 9,
          allowed_intents_free: ['faq_search'],
          allowed_intents_pro: ['next_action', 'risk_alert', 'faq_search'],
          safety_mode: 'strict'
        }
      })
    );

    assert.equal(planRes.result.statusCode, 200, planRes.result.body);
    const planBody = planRes.json();
    assert.equal(planBody.ok, true);
    assert.equal(planBody.llmPolicy.max_output_tokens, 700);
    assert.equal(planBody.llmPolicy.per_user_daily_limit, 33);
    assert.equal(planBody.llmPolicy.global_qps_limit, 9);
    assert.ok(planBody.llmPolicy.allowed_intents_pro.includes('next_action_generation'));
    assert.equal(planBody.canonicalization.maxTokensAliasApplied, true);
    assert.equal(planBody.canonicalization.perUserLimitAliasApplied, true);
    assert.equal(planBody.canonicalization.rateLimitAliasApplied, true);

    const setRes = createResCapture();
    await handleSet(
      Object.assign({ url: '/api/admin/llm/policy/set' }, reqBase),
      setRes,
      JSON.stringify({
        planHash: planBody.planHash,
        confirmToken: planBody.confirmToken,
        policy: {
          enabled: true,
          temperature: 0.3,
          max_tokens: 700,
          per_user_limit: 33,
          rate_limit: 9,
          allowed_intents_free: ['faq_search'],
          allowed_intents_pro: ['next_action', 'risk_alert', 'faq_search'],
          safety_mode: 'strict'
        }
      })
    );

    assert.equal(setRes.result.statusCode, 200, setRes.result.body);
    const setBody = setRes.json();
    assert.equal(setBody.ok, true);
    assert.equal(setBody.llmPolicy.max_output_tokens, 700);
    assert.equal(setBody.llmPolicy.per_user_daily_limit, 33);
    assert.equal(setBody.llmPolicy.global_qps_limit, 9);

    const historyRes = createResCapture();
    await handleHistory(
      Object.assign({ url: '/api/admin/os/llm-policy/history?limit=5' }, reqBase),
      historyRes
    );

    assert.equal(historyRes.result.statusCode, 200, historyRes.result.body);
    const historyBody = historyRes.json();
    assert.equal(historyBody.ok, true);
    assert.ok(Array.isArray(historyBody.items));
    assert.ok(historyBody.items.length >= 1);
    const first = historyBody.items[0];
    assert.equal(first.policy.max_output_tokens, 700);
    assert.equal(first.policy.per_user_daily_limit, 33);
    assert.equal(first.policy.global_qps_limit, 9);

    const changeLogs = await db.collection('llm_policy_change_logs').get();
    assert.ok(changeLogs.docs.length >= 1);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
