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
  handleSet,
  handleHistory
} = require('../../src/routes/admin/richMenuConfig');

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

test('phase663: rich menu admin route supports status/history + plan/set two-step confirmation', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase663_rich_menu_confirm_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const statusReq = {
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_status', 'x-trace-id': 'trace_status' },
      url: '/api/admin/os/rich-menu/status'
    };
    const statusRes = createResCapture();
    await handleStatus(statusReq, statusRes);
    assert.equal(statusRes.result.statusCode, 200);
    const statusBody = statusRes.readJson();
    assert.equal(statusBody.ok, true);
    assert.ok(statusBody.policy);
    assert.ok(Array.isArray(statusBody.templates));
    assert.ok(Array.isArray(statusBody.rules));
    assert.ok(Array.isArray(statusBody.phaseProfiles));

    const actionPayload = {
      policy: {
        enabled: true,
        updateEnabled: true,
        defaultTemplateId: 'default_ja',
        fallbackTemplateId: 'default_ja',
        cooldownSeconds: 21600,
        maxAppliesPerMinute: 60,
        maxTargetsPerApply: 200,
        allowLegacyJourneyPolicyFallback: true
      }
    };

    const planRes = createResCapture();
    await handlePlan({
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_plan', 'x-trace-id': 'trace_plan' },
      url: '/api/admin/os/rich-menu/plan'
    }, planRes, JSON.stringify({
      action: 'set_policy',
      payload: actionPayload
    }));
    assert.equal(planRes.result.statusCode, 200);
    const planBody = planRes.readJson();
    assert.equal(planBody.ok, true);
    assert.equal(planBody.action, 'set_policy');
    assert.ok(typeof planBody.planHash === 'string' && planBody.planHash.startsWith('richmenu_'));
    assert.ok(typeof planBody.confirmToken === 'string' && planBody.confirmToken.length > 10);

    const hashMismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_set_hash_ng', 'x-trace-id': 'trace_set_hash_ng' },
      url: '/api/admin/os/rich-menu/set'
    }, hashMismatchRes, JSON.stringify({
      action: 'set_policy',
      payload: actionPayload,
      planHash: 'richmenu_deadbeefdeadbeefdead',
      confirmToken: planBody.confirmToken
    }));
    assert.equal(hashMismatchRes.result.statusCode, 409);
    assert.equal(hashMismatchRes.readJson().reason, 'plan_hash_mismatch');

    const tokenMismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_set_token_ng', 'x-trace-id': 'trace_set_token_ng' },
      url: '/api/admin/os/rich-menu/set'
    }, tokenMismatchRes, JSON.stringify({
      action: 'set_policy',
      payload: actionPayload,
      planHash: planBody.planHash,
      confirmToken: 'invalid_confirm_token'
    }));
    assert.equal(tokenMismatchRes.result.statusCode, 409);
    assert.equal(tokenMismatchRes.readJson().reason, 'confirm_token_mismatch');

    const setRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_set_ok', 'x-trace-id': 'trace_set_ok' },
      url: '/api/admin/os/rich-menu/set'
    }, setRes, JSON.stringify({
      action: 'set_policy',
      payload: actionPayload,
      planHash: planBody.planHash,
      confirmToken: planBody.confirmToken
    }));
    assert.equal(setRes.result.statusCode, 200);
    const setBody = setRes.readJson();
    assert.equal(setBody.ok, true);
    assert.equal(setBody.policy.enabled, true);
    assert.equal(setBody.policy.defaultTemplateId, 'default_ja');

    const policyDoc = await db.collection('opsConfig').doc('richMenuPolicy').get();
    assert.equal(policyDoc.exists, true);
    assert.equal(policyDoc.data().enabled, true);
    assert.equal(policyDoc.data().updatedBy, 'phase663_test');

    const historyRes = createResCapture();
    await handleHistory({
      headers: { 'x-actor': 'phase663_test', 'x-request-id': 'req_history', 'x-trace-id': 'trace_history' },
      url: '/api/admin/os/rich-menu/history?limit=20'
    }, historyRes);
    assert.equal(historyRes.result.statusCode, 200);
    const historyBody = historyRes.readJson();
    assert.equal(historyBody.ok, true);
    assert.ok(Array.isArray(historyBody.runs));

    const audits = db._state.collections.audit_logs;
    assert.ok(audits && Object.keys(audits.docs).length >= 4, 'rich menu audit logs should be appended');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

