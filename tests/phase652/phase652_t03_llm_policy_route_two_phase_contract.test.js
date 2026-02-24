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
const {
  handleStatus,
  handlePlan,
  handleSet
} = require('../../src/routes/admin/llmPolicyConfig');

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

test('phase652: llm policy status/plan/set supports two-step confirmation and mismatch guards', async () => {
  const restoreEnv = withEnv({ LLM_FEATURE_FLAG: 'true' });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await db.collection('system_flags').doc('phase0').set({ llmEnabled: true }, { merge: true });

    const statusReq = {
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_status', 'x-trace-id': 'trace_status' },
      url: '/api/admin/llm/policy/status'
    };
    const statusRes = createResCapture();
    await handleStatus(statusReq, statusRes);
    assert.equal(statusRes.result.statusCode, 200);
    const statusBody = statusRes.readJson();
    assert.equal(statusBody.ok, true);
    assert.equal(typeof statusBody.effectiveEnabled, 'boolean');

    const policy = {
      enabled: true,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      top_p: 1,
      max_output_tokens: 700,
      per_user_daily_limit: 40,
      per_user_token_budget: 20000,
      global_qps_limit: 12,
      cache_ttl_sec: 300,
      allowed_intents_free: ['faq_search'],
      allowed_intents_pro: ['faq_search', 'risk_alert'],
      safety_mode: 'strict'
    };

    const planReq = {
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_plan', 'x-trace-id': 'trace_plan' },
      url: '/api/admin/llm/policy/plan'
    };
    const planRes = createResCapture();
    await handlePlan(planReq, planRes, JSON.stringify({ policy }));
    assert.equal(planRes.result.statusCode, 200);
    const planBody = planRes.readJson();
    assert.equal(planBody.ok, true);
    assert.ok(typeof planBody.planHash === 'string' && planBody.planHash.startsWith('llmpolicy_'));
    assert.ok(typeof planBody.confirmToken === 'string' && planBody.confirmToken.length > 10);

    const mismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_set_mismatch', 'x-trace-id': 'trace_set_mismatch' },
      url: '/api/admin/llm/policy/set'
    }, mismatchRes, JSON.stringify({
      policy,
      planHash: 'llmpolicy_deadbeefdeadbeefdead',
      confirmToken: planBody.confirmToken
    }));
    assert.equal(mismatchRes.result.statusCode, 409);
    assert.equal(mismatchRes.readJson().reason, 'plan_hash_mismatch');

    const tokenMismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_set_token_mismatch', 'x-trace-id': 'trace_set_token_mismatch' },
      url: '/api/admin/llm/policy/set'
    }, tokenMismatchRes, JSON.stringify({
      policy,
      planHash: planBody.planHash,
      confirmToken: 'invalid_token_value'
    }));
    assert.equal(tokenMismatchRes.result.statusCode, 409);
    assert.equal(tokenMismatchRes.readJson().reason, 'confirm_token_mismatch');

    const setRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase652_test', 'x-request-id': 'req_set_ok', 'x-trace-id': 'trace_set_ok' },
      url: '/api/admin/llm/policy/set'
    }, setRes, JSON.stringify({
      policy,
      planHash: planBody.planHash,
      confirmToken: planBody.confirmToken
    }));
    assert.equal(setRes.result.statusCode, 200);
    const setBody = setRes.readJson();
    assert.equal(setBody.ok, true);
    assert.equal(setBody.llmPolicy.enabled, true);
    assert.equal(setBody.llmPolicy.max_output_tokens, 700);

    const saved = await db.collection('opsConfig').doc('llmPolicy').get();
    assert.equal(saved.exists, true);
    assert.equal(saved.data().enabled, true);
    assert.equal(saved.data().updatedBy, 'phase652_test');

    const audits = db._state.collections.audit_logs;
    assert.ok(audits && Object.keys(audits.docs).length >= 4, 'audit logs should include status/plan/set traces');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
