'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  executeDesktopPatrolApprovalAction
} = require('../../src/usecases/qualityPatrol/executeDesktopPatrolApprovalAction');

test('phase903: approval execute runs the next synth step and refreshes the operator summary', async (t) => {
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

  let queryCount = 0;
  const result = await executeDesktopPatrolApprovalAction({
    proposalId: 'prop_903_exec'
  }, {
    repoRoot: '/tmp/member-repo',
    queryLatestDesktopPatrolSummary: async () => {
      queryCount += 1;
      if (queryCount === 1) {
        return {
          promotionApproval: {
            latestProposalId: 'prop_903_exec',
            approvalStage: 'patch_request',
            approvalStatus: 'ready_for_human_patch',
            branchName: 'codex/desktop-prop-903-exec',
            worktreeRef: { path: '/tmp/member-desktop-prop-903-exec' }
          }
        };
      }
      return {
        ok: true,
        promotionApproval: {
          latestProposalId: 'prop_903_exec',
          approvalStage: 'code_apply_task',
          approvalStatus: 'ready_for_human_code_apply_task'
        }
      };
    },
    execFile: async (file, args, options) => {
      assert.equal(file, 'python3');
      assert.deepEqual(args.slice(0, 2), ['-m', 'member_line_patrol.synthesize_code_apply_task']);
      assert.ok(args.includes('--proposal-id'));
      assert.ok(args.includes('prop_903_exec'));
      assert.equal(options.cwd, '/tmp/member-repo');
      assert.equal(options.env.PYTHONPATH, '/tmp/member-repo/tools/line_desktop_patrol/src');
      return {
        stdout: JSON.stringify({
          ok: true,
          status: 'synthesized',
          artifact_kind: 'code_apply_task'
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposalId, 'prop_903_exec');
  assert.equal(result.approvalStage, 'patch_request');
  assert.equal(result.nextArtifactKind, 'code_apply_task');
  assert.equal(result.executionResult.status, 'synthesized');
  assert.equal(result.desktopPatrolSummary.promotionApproval.approvalStage, 'code_apply_task');
});

test('phase903: approval execute stays blocked outside local/test environments', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnvName = process.env.ENV_NAME;
  delete process.env.NODE_ENV;
  process.env.ENV_NAME = 'stg';
  t.after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = originalEnvName;
  });

  await assert.rejects(() => {
    return executeDesktopPatrolApprovalAction({
      plan: {
        ok: true,
        proposalId: 'prop_blocked',
        approvalStage: 'patch_request',
        nextArtifactKind: 'code_apply_task',
        planHash: 'desktopapproval_deadbeefdeadbeefdeadbeef',
        command: 'npm run line-desktop-patrol:synthesize-code-apply-task -- --proposal-id prop_blocked',
        moduleName: 'member_line_patrol.synthesize_code_apply_task'
      }
    }, {});
  }, (err) => {
    assert.equal(err && err.code, 'desktop_patrol_approval_local_only');
    assert.equal(err && err.statusCode, 409);
    return true;
  });
});
