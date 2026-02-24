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
} = require('../../src/routes/admin/journeyPolicyConfig');

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

test('phase653: journey policy status/plan/set supports two-step confirmation and mismatch guards', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase653_journey_confirm_secret',
    ENABLE_JOURNEY_REMINDER_JOB: '1',
    ENABLE_RICH_MENU_DYNAMIC: '1',
    ENABLE_PAID_FAQ_QUALITY_V2: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const statusReq = {
      headers: { 'x-actor': 'phase653_test', 'x-request-id': 'req_status', 'x-trace-id': 'trace_status' },
      url: '/api/admin/os/journey-policy/status'
    };
    const statusRes = createResCapture();
    await handleStatus(statusReq, statusRes);
    assert.equal(statusRes.result.statusCode, 200);
    const statusBody = statusRes.readJson();
    assert.equal(statusBody.ok, true);
    assert.equal(typeof statusBody.effectiveEnabled, 'boolean');

    const journeyPolicy = {
      enabled: true,
      reminder_offsets_days: [7, 3, 1],
      reminder_max_per_run: 120,
      paid_only_reminders: true,
      rich_menu_enabled: true,
      schedule_required_for_reminders: true,
      rich_menu_map: {
        free_default: 'richmenu_free',
        pro_single: 'richmenu_pro_single',
        pro_couple: 'richmenu_pro_couple',
        pro_accompany1: 'richmenu_pro_acc1',
        pro_accompany2: 'richmenu_pro_acc2'
      },
      auto_upgrade_message_enabled: true,
      auto_downgrade_message_enabled: true
    };

    const planRes = createResCapture();
    await handlePlan({
      headers: { 'x-actor': 'phase653_test', 'x-request-id': 'req_plan', 'x-trace-id': 'trace_plan' },
      url: '/api/admin/os/journey-policy/plan'
    }, planRes, JSON.stringify({ policy: journeyPolicy }));
    assert.equal(planRes.result.statusCode, 200);
    const planBody = planRes.readJson();
    assert.equal(planBody.ok, true);
    assert.ok(typeof planBody.planHash === 'string' && planBody.planHash.startsWith('journeypolicy_'));
    assert.ok(typeof planBody.confirmToken === 'string' && planBody.confirmToken.length > 10);

    const hashMismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase653_test', 'x-request-id': 'req_set_hash_ng', 'x-trace-id': 'trace_set_hash_ng' },
      url: '/api/admin/os/journey-policy/set'
    }, hashMismatchRes, JSON.stringify({
      policy: journeyPolicy,
      planHash: 'journeypolicy_deadbeefdeadbeefdead',
      confirmToken: planBody.confirmToken
    }));
    assert.equal(hashMismatchRes.result.statusCode, 409);
    assert.equal(hashMismatchRes.readJson().reason, 'plan_hash_mismatch');

    const tokenMismatchRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase653_test', 'x-request-id': 'req_set_token_ng', 'x-trace-id': 'trace_set_token_ng' },
      url: '/api/admin/os/journey-policy/set'
    }, tokenMismatchRes, JSON.stringify({
      policy: journeyPolicy,
      planHash: planBody.planHash,
      confirmToken: 'invalid_confirm_token'
    }));
    assert.equal(tokenMismatchRes.result.statusCode, 409);
    assert.equal(tokenMismatchRes.readJson().reason, 'confirm_token_mismatch');

    const setRes = createResCapture();
    await handleSet({
      headers: { 'x-actor': 'phase653_test', 'x-request-id': 'req_set_ok', 'x-trace-id': 'trace_set_ok' },
      url: '/api/admin/os/journey-policy/set'
    }, setRes, JSON.stringify({
      policy: journeyPolicy,
      planHash: planBody.planHash,
      confirmToken: planBody.confirmToken
    }));
    assert.equal(setRes.result.statusCode, 200);
    const setBody = setRes.readJson();
    assert.equal(setBody.ok, true);
    assert.equal(setBody.journeyPolicy.enabled, true);
    assert.equal(setBody.journeyPolicy.reminder_max_per_run, 120);

    const saved = await db.collection('opsConfig').doc('journeyPolicy').get();
    assert.equal(saved.exists, true);
    assert.equal(saved.data().enabled, true);
    assert.equal(saved.data().updatedBy, 'phase653_test');

    const audits = db._state.collections.audit_logs;
    assert.ok(audits && Object.keys(audits.docs).length >= 4, 'journey policy audit logs should be appended');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
