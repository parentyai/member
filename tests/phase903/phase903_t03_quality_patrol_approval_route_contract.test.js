'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  handleQualityPatrolApprovalPlan,
  handleQualityPatrolApprovalExecute
} = require('../../src/routes/admin/qualityPatrol');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk || '';
    }
  };
}

test('phase903: approval plan route returns planHash and confirmToken with audit evidence', async () => {
  const audits = [];
  const req = {
    method: 'POST',
    url: '/api/admin/quality-patrol/desktop-approval/plan',
    headers: {
      'x-actor': 'operator',
      'x-trace-id': 'trace_phase903_plan'
    }
  };
  const res = createResponseRecorder();

  await handleQualityPatrolApprovalPlan(req, res, JSON.stringify({
    proposalId: 'prop_route_903'
  }), {
    queryLatestDesktopPatrolSummary: async () => ({
      promotionApproval: {
        latestProposalId: 'prop_route_903',
        approvalStage: 'patch_request',
        approvalStatus: 'ready_for_human_patch',
        branchName: 'codex/desktop-route-903',
        worktreeRef: { path: '/tmp/member-desktop-route-903' }
      }
    }),
    appendAuditLog: async (entry) => {
      audits.push(entry);
    }
  });

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.proposalId, 'prop_route_903');
  assert.match(body.planHash, /^desktopapproval_[a-f0-9]{24}$/);
  assert.equal(typeof body.confirmToken, 'string');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'quality_patrol.desktop_approval.plan');
});

test('phase903: approval execute route rejects stale planHash before running the synth command', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnvName = process.env.ENV_NAME;
  process.env.NODE_ENV = 'test';
  delete process.env.ENV_NAME;
  t.after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = originalEnvName;
  });

  const reqPlan = {
    method: 'POST',
    url: '/api/admin/quality-patrol/desktop-approval/plan',
    headers: {
      'x-actor': 'operator',
      'x-trace-id': 'trace_phase903_stale_plan'
    }
  };
  const resPlan = createResponseRecorder();
  const deps = {
    queryLatestDesktopPatrolSummary: async () => ({
      promotionApproval: {
        latestProposalId: 'prop_route_904',
        approvalStage: 'patch_request',
        approvalStatus: 'ready_for_human_patch',
        branchName: 'codex/desktop-route-904',
        worktreeRef: { path: '/tmp/member-desktop-route-904' }
      }
    }),
    execFile: async () => {
      throw new Error('execFile must not run on stale plan');
    }
  };
  await handleQualityPatrolApprovalPlan(reqPlan, resPlan, JSON.stringify({
    proposalId: 'prop_route_904'
  }), deps);
  const planned = JSON.parse(resPlan.body);

  const reqExecute = {
    method: 'POST',
    url: '/api/admin/quality-patrol/desktop-approval/execute',
    headers: {
      'x-actor': 'operator',
      'x-trace-id': 'trace_phase903_stale_execute'
    }
  };
  const resExecute = createResponseRecorder();
  await handleQualityPatrolApprovalExecute(reqExecute, resExecute, JSON.stringify({
    proposalId: 'prop_route_904',
    approvalStage: 'patch_request',
    planHash: 'desktopapproval_stale000000000000000000',
    confirmToken: planned.confirmToken
  }), deps);

  assert.equal(resExecute.statusCode, 409);
  const body = JSON.parse(resExecute.body);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'desktop_patrol_approval_plan_stale');
});

test('phase903: approval execute route enforces managed flow and returns refreshed summary on success', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnvName = process.env.ENV_NAME;
  process.env.NODE_ENV = 'test';
  delete process.env.ENV_NAME;
  t.after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = originalEnvName;
  });

  const audits = [];
  let queryCount = 0;
  const deps = {
    repoRoot: '/tmp/member-route-exec',
    queryLatestDesktopPatrolSummary: async () => {
      queryCount += 1;
      if (queryCount <= 2) {
        return {
          promotionApproval: {
            latestProposalId: 'prop_route_905',
            approvalStage: 'code_apply_task',
            approvalStatus: 'ready_for_human_code_apply_task',
            branchName: 'codex/desktop-route-905',
            worktreeRef: { path: '/tmp/member-desktop-route-905' }
          }
        };
      }
      return {
        ok: true,
        promotionApproval: {
          latestProposalId: 'prop_route_905',
          approvalStage: 'code_apply_signoff',
          approvalStatus: 'ready_for_human_apply_signoff'
        }
      };
    },
    execFile: async () => ({
      stdout: JSON.stringify({
        ok: true,
        status: 'synthesized',
        artifact_kind: 'code_apply_signoff'
      })
    }),
    appendAuditLog: async (entry) => {
      audits.push(entry);
    }
  };

  const reqPlan = {
    method: 'POST',
    url: '/api/admin/quality-patrol/desktop-approval/plan',
    headers: {
      'x-actor': 'operator',
      'x-trace-id': 'trace_phase903_execute_plan'
    }
  };
  const resPlan = createResponseRecorder();
  await handleQualityPatrolApprovalPlan(reqPlan, resPlan, JSON.stringify({
    proposalId: 'prop_route_905'
  }), deps);
  const planned = JSON.parse(resPlan.body);

  const reqExecute = {
    method: 'POST',
    url: '/api/admin/quality-patrol/desktop-approval/execute',
    headers: {
      'x-actor': 'operator',
      'x-trace-id': 'trace_phase903_execute'
    }
  };
  const resExecute = createResponseRecorder();
  await handleQualityPatrolApprovalExecute(reqExecute, resExecute, JSON.stringify({
    proposalId: 'prop_route_905',
    approvalStage: 'code_apply_task',
    planHash: planned.planHash,
    confirmToken: planned.confirmToken
  }), deps);

  assert.equal(resExecute.statusCode, 200);
  const body = JSON.parse(resExecute.body);
  assert.equal(body.ok, true);
  assert.equal(body.proposalId, 'prop_route_905');
  assert.equal(body.executionResult.status, 'synthesized');
  assert.equal(body.desktopPatrolSummary.promotionApproval.approvalStage, 'code_apply_signoff');
  assert.ok(audits.some((entry) => entry.action === 'quality_patrol.desktop_approval.execute'));
});
