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
  const stagedHeaders = {};
  const out = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    setHeader(name, value) {
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      out.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      out.headers = Object.assign({}, stagedHeaders, normalized);
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

function makeReq(path, requestId) {
  return {
    headers: {
      'x-actor': 'phase900_t29',
      'x-request-id': requestId || 'req_phase900_t29',
      'x-trace-id': `trace_${requestId || 'phase900_t29'}`
    },
    url: path
  };
}

function buildPolicy() {
  return {
    enabled: true,
    reminder_offsets_days: [7, 3, 1],
    reminder_max_per_run: 120,
    paid_only_reminders: true,
    notificationCaps: {
      quietHours: {
        startHourUtc: 22,
        endHourUtc: 7
      }
    },
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
}

test('phase900: journey policy status emits completed outcome metadata', async () => {
  const restoreEnv = withEnv({
    ENABLE_JOURNEY_REMINDER_JOB: '1',
    ENABLE_RICH_MENU_DYNAMIC: '1',
    ENABLE_PAID_FAQ_QUALITY_V2: '1'
  });
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const res = createResCapture();
    await handleStatus(makeReq('/api/admin/os/journey-policy/status', 'req_status'), res);
    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_policy_status');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase900: journey policy plan invalid policy emits normalized outcome metadata', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase900_t29_secret'
  });
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const res = createResCapture();
    await handlePlan(
      makeReq('/api/admin/os/journey-policy/plan', 'req_plan_invalid'),
      res,
      JSON.stringify({
        policy: {
          rich_menu_map: []
        }
      })
    );
    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_journey_policy');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_policy_plan');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase900: journey policy set confirm token mismatch emits blocked outcome metadata', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase900_t29_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const policy = buildPolicy();
    const planRes = createResCapture();
    await handlePlan(
      makeReq('/api/admin/os/journey-policy/plan', 'req_plan_blocked'),
      planRes,
      JSON.stringify({ policy })
    );
    assert.equal(planRes.result.statusCode, 200);
    const planBody = planRes.readJson();

    const setRes = createResCapture();
    await handleSet(
      makeReq('/api/admin/os/journey-policy/set', 'req_set_blocked'),
      setRes,
      JSON.stringify({
        policy,
        planHash: planBody.planHash,
        confirmToken: 'invalid_confirm_token'
      })
    );
    const setBody = setRes.readJson();
    assert.equal(setRes.result.statusCode, 409);
    assert.equal(setBody.outcome && setBody.outcome.state, 'blocked');
    assert.equal(setBody.outcome && setBody.outcome.reason, 'confirm_token_mismatch');
    assert.equal(setBody.outcome && setBody.outcome.guard && setBody.outcome.guard.routeKey, 'admin.journey_policy_set');
    assert.equal(setRes.result.headers['x-member-outcome-state'], 'blocked');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase900: journey policy set success emits completed outcome metadata', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase900_t29_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const policy = buildPolicy();
    const planRes = createResCapture();
    await handlePlan(
      makeReq('/api/admin/os/journey-policy/plan', 'req_plan_ok'),
      planRes,
      JSON.stringify({ policy })
    );
    const planBody = planRes.readJson();

    const setRes = createResCapture();
    await handleSet(
      makeReq('/api/admin/os/journey-policy/set', 'req_set_ok'),
      setRes,
      JSON.stringify({
        policy,
        planHash: planBody.planHash,
        confirmToken: planBody.confirmToken
      })
    );
    const setBody = setRes.readJson();
    assert.equal(setRes.result.statusCode, 200);
    assert.equal(setBody.outcome && setBody.outcome.state, 'success');
    assert.equal(setBody.outcome && setBody.outcome.reason, 'completed');
    assert.equal(setBody.outcome && setBody.outcome.guard && setBody.outcome.guard.routeKey, 'admin.journey_policy_set');
    assert.equal(setRes.result.headers['x-member-outcome-state'], 'success');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
