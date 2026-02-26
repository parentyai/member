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
  handleApply,
  handleRollback,
  handleHistory
} = require('../../src/routes/admin/journeyParamConfig');

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

function req(url, requestId) {
  return {
    url,
    headers: {
      'x-actor': 'phase665_test',
      'x-request-id': requestId,
      'x-trace-id': requestId
    }
  };
}

test('phase665: journey-param route supports plan -> validate -> dry-run -> apply -> rollback -> history', async () => {
  const restoreEnv = withEnv({
    OPS_CONFIRM_TOKEN_SECRET: 'phase665_journey_param_confirm_secret',
    ENABLE_JOURNEY_PARAM_VERSIONING_V1: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const statusRes = createResCapture();
    await handleStatus(req('/api/admin/os/journey-param/status', 'req_status_1'), statusRes);
    assert.equal(statusRes.result.statusCode, 200);
    const statusBody = statusRes.readJson();
    assert.equal(statusBody.ok, true);

    const baseParameters = {
      graph: {
        enabled: true,
        nodes: [
          { nodeKey: 'P665_A', title: 'A', planTier: 'all' },
          { nodeKey: 'P665_B', title: 'B', planTier: 'all' }
        ],
        edges: [
          { from: 'P665_A', to: 'P665_B', reasonType: 'prerequisite', required: true, enabled: true }
        ]
      },
      journeyPolicy: {
        enabled: true,
        reminder_offsets_days: [7, 3, 1]
      },
      llmPolicyPatch: {
        policy_version_id: 'jpv_665_v1',
        refusal_strategy: {
          mode: 'faq_only',
          show_blocked_reason: true,
          fallback: 'free_retrieval'
        }
      }
    };

    const planV1Res = createResCapture();
    await handlePlan(req('/api/admin/os/journey-param/plan', 'req_plan_v1'), planV1Res, JSON.stringify({
      note: 'v1',
      parameters: baseParameters
    }));
    assert.equal(planV1Res.result.statusCode, 200);
    const planV1 = planV1Res.readJson();
    assert.equal(planV1.ok, true);
    assert.ok(planV1.version && planV1.version.versionId);
    assert.ok(planV1.planHash && planV1.confirmToken);

    const versionIdV1 = planV1.version.versionId;

    const validateV1Res = createResCapture();
    await handleValidate(req('/api/admin/os/journey-param/validate', 'req_validate_v1'), validateV1Res, JSON.stringify({
      versionId: versionIdV1
    }));
    assert.equal(validateV1Res.result.statusCode, 200);
    const validateV1 = validateV1Res.readJson();
    assert.equal(validateV1.ok, true);
    assert.equal(validateV1.validation.ok, true);

    const dryRunV1Res = createResCapture();
    await handleDryRun(req('/api/admin/os/journey-param/dry-run', 'req_dry_v1'), dryRunV1Res, JSON.stringify({
      versionId: versionIdV1,
      scope: { lineUserIds: ['U_PHASE665_1'] },
      horizonDays: 30
    }));
    assert.equal(dryRunV1Res.result.statusCode, 200);
    const dryRunV1 = dryRunV1Res.readJson();
    assert.equal(dryRunV1.ok, true);
    assert.ok(dryRunV1.dryRun && dryRunV1.dryRun.hash);

    const applyV1Res = createResCapture();
    await handleApply(req('/api/admin/os/journey-param/apply', 'req_apply_v1'), applyV1Res, JSON.stringify({
      versionId: versionIdV1,
      planHash: planV1.planHash,
      confirmToken: planV1.confirmToken,
      latestDryRunHash: dryRunV1.dryRun.hash
    }));
    assert.equal(applyV1Res.result.statusCode, 200);
    const applyV1 = applyV1Res.readJson();
    assert.equal(applyV1.ok, true);
    assert.equal(applyV1.runtime.activeVersionId, versionIdV1);

    const planV2Res = createResCapture();
    await handlePlan(req('/api/admin/os/journey-param/plan', 'req_plan_v2'), planV2Res, JSON.stringify({
      note: 'v2',
      parameters: {
        graph: {
          planUnlocks: {
            free: { includePlanTiers: ['all'], maxNextActions: 1 },
            pro: { includePlanTiers: ['all', 'pro'], maxNextActions: 2 }
          }
        },
        llmPolicyPatch: {
          policy_version_id: 'jpv_665_v2'
        }
      }
    }));
    assert.equal(planV2Res.result.statusCode, 200);
    const planV2 = planV2Res.readJson();
    const versionIdV2 = planV2.version.versionId;

    const validateV2Res = createResCapture();
    await handleValidate(req('/api/admin/os/journey-param/validate', 'req_validate_v2'), validateV2Res, JSON.stringify({
      versionId: versionIdV2
    }));
    assert.equal(validateV2Res.result.statusCode, 200);

    const dryRunV2Res = createResCapture();
    await handleDryRun(req('/api/admin/os/journey-param/dry-run', 'req_dry_v2'), dryRunV2Res, JSON.stringify({
      versionId: versionIdV2,
      scope: { lineUserIds: ['U_PHASE665_2'] },
      horizonDays: 30
    }));
    assert.equal(dryRunV2Res.result.statusCode, 200);
    const dryRunV2 = dryRunV2Res.readJson();

    const applyV2Res = createResCapture();
    await handleApply(req('/api/admin/os/journey-param/apply', 'req_apply_v2'), applyV2Res, JSON.stringify({
      versionId: versionIdV2,
      planHash: planV2.planHash,
      confirmToken: planV2.confirmToken,
      latestDryRunHash: dryRunV2.dryRun.hash
    }));
    assert.equal(applyV2Res.result.statusCode, 200);
    const applyV2 = applyV2Res.readJson();
    assert.equal(applyV2.ok, true);
    assert.equal(applyV2.runtime.activeVersionId, versionIdV2);
    assert.equal(applyV2.runtime.previousAppliedVersionId, versionIdV1);

    const rollbackPlanRes = createResCapture();
    await handlePlan(req('/api/admin/os/journey-param/plan', 'req_rb_plan'), rollbackPlanRes, JSON.stringify({
      action: 'rollback_plan',
      versionId: versionIdV2,
      rollbackToVersionId: versionIdV1
    }));
    assert.equal(rollbackPlanRes.result.statusCode, 200);
    const rollbackPlan = rollbackPlanRes.readJson();
    assert.equal(rollbackPlan.ok, true);
    assert.ok(rollbackPlan.planHash);
    assert.ok(rollbackPlan.confirmToken);

    const rollbackRes = createResCapture();
    await handleRollback(req('/api/admin/os/journey-param/rollback', 'req_rb_apply'), rollbackRes, JSON.stringify({
      versionId: versionIdV2,
      rollbackToVersionId: versionIdV1,
      planHash: rollbackPlan.planHash,
      confirmToken: rollbackPlan.confirmToken
    }));
    assert.equal(rollbackRes.result.statusCode, 200);
    const rollbackBody = rollbackRes.readJson();
    assert.equal(rollbackBody.ok, true);
    assert.equal(rollbackBody.runtime.activeVersionId, versionIdV1);

    const historyRes = createResCapture();
    await handleHistory(req('/api/admin/os/journey-param/history?limit=20', 'req_hist_1'), historyRes);
    assert.equal(historyRes.result.statusCode, 200);
    const historyBody = historyRes.readJson();
    assert.equal(historyBody.ok, true);
    assert.ok(Array.isArray(historyBody.changes));
    assert.ok(historyBody.changes.length >= 4);

    const runtimeDoc = await db.collection('opsConfig').doc('journeyParamRuntime').get();
    assert.equal(runtimeDoc.exists, true);
    assert.equal(runtimeDoc.data().activeVersionId, versionIdV1);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
