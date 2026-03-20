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
  handleValidate,
  handleDryRun,
  handleApply
} = require('../../src/routes/admin/journeyParamConfig');

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

function req(url, traceId) {
  return {
    url,
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': traceId,
      'x-request-id': traceId
    }
  };
}

async function withJourneyParamHarness(run) {
  const prevConfirmSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  const prevVersionFlag = process.env.ENABLE_JOURNEY_PARAM_VERSIONING_V1;
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'phase900_t48_confirm_secret';
  process.env.ENABLE_JOURNEY_PARAM_VERSIONING_V1 = '1';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    await run();
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevConfirmSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevConfirmSecret;
    if (prevVersionFlag === undefined) delete process.env.ENABLE_JOURNEY_PARAM_VERSIONING_V1;
    else process.env.ENABLE_JOURNEY_PARAM_VERSIONING_V1 = prevVersionFlag;
  }
}

test('phase900: journey param status success emits completed outcome metadata', async () => {
  await withJourneyParamHarness(async () => {
    const res = createResCapture();
    await handleStatus(req('/api/admin/os/journey-param/status', 'trace_phase900_t48_status'), res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_param_config');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: journey param plan invalid json emits normalized error outcome metadata', async () => {
  await withJourneyParamHarness(async () => {
    const res = createResCapture();
    await handlePlan(req('/api/admin/os/journey-param/plan', 'trace_phase900_t48_invalid_json'), res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.journey_param_config');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: journey param apply plan hash mismatch emits normalized error outcome metadata', async () => {
  await withJourneyParamHarness(async () => {
    const parameters = {
      graph: {
        enabled: true,
        nodes: [
          { nodeKey: 'P900_T48_A', title: 'A', planTier: 'all' },
          { nodeKey: 'P900_T48_B', title: 'B', planTier: 'all' }
        ],
        edges: [
          { from: 'P900_T48_A', to: 'P900_T48_B', reasonType: 'prerequisite', required: true, enabled: true }
        ]
      },
      journeyPolicy: {
        enabled: true,
        reminder_offsets_days: [7, 3, 1]
      },
      llmPolicyPatch: {
        policy_version_id: 'jpv_900_t48'
      }
    };

    const planRes = createResCapture();
    await handlePlan(req('/api/admin/os/journey-param/plan', 'trace_phase900_t48_plan'), planRes, JSON.stringify({
      note: 'phase900_t48',
      parameters
    }));
    const planBody = planRes.readJson();
    assert.equal(planRes.result.statusCode, 200);
    assert.equal(planBody.ok, true);

    const versionId = planBody.version && planBody.version.versionId;
    assert.ok(versionId);

    const validateRes = createResCapture();
    await handleValidate(req('/api/admin/os/journey-param/validate', 'trace_phase900_t48_validate'), validateRes, JSON.stringify({
      versionId
    }));
    assert.equal(validateRes.result.statusCode, 200);

    const dryRunRes = createResCapture();
    await handleDryRun(req('/api/admin/os/journey-param/dry-run', 'trace_phase900_t48_dry_run'), dryRunRes, JSON.stringify({
      versionId,
      scope: { lineUserIds: ['U_PHASE900_T48'] },
      horizonDays: 30
    }));
    const dryRunBody = dryRunRes.readJson();
    assert.equal(dryRunRes.result.statusCode, 200);
    assert.ok(dryRunBody.dryRun && dryRunBody.dryRun.hash);

    const applyRes = createResCapture();
    await handleApply(req('/api/admin/os/journey-param/apply', 'trace_phase900_t48_apply_mismatch'), applyRes, JSON.stringify({
      versionId,
      planHash: `${planBody.planHash}_mismatch`,
      confirmToken: planBody.confirmToken,
      latestDryRunHash: dryRunBody.dryRun.hash
    }));

    const applyBody = applyRes.readJson();
    assert.equal(applyRes.result.statusCode, 409);
    assert.equal(applyBody.ok, false);
    assert.equal(applyBody.reason, 'plan_hash_mismatch');
    assert.equal(applyBody.outcome && applyBody.outcome.state, 'error');
    assert.equal(applyBody.outcome && applyBody.outcome.reason, 'plan_hash_mismatch');
    assert.equal(applyBody.outcome && applyBody.outcome.guard && applyBody.outcome.guard.routeKey, 'admin.journey_param_config');
    assert.equal(applyRes.result.headers['x-member-outcome-state'], 'error');
    assert.equal(applyRes.result.headers['x-member-outcome-reason'], 'plan_hash_mismatch');
    assert.equal(applyRes.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
