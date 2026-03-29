'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  planDesktopPatrolApprovalAction
} = require('../../src/usecases/qualityPatrol/planDesktopPatrolApprovalAction');

test('phase903: approval plan returns command, planHash, and confirmToken for the latest operator lane', async () => {
  const result = await planDesktopPatrolApprovalAction({
    proposalId: 'prop_903'
  }, {
    queryLatestDesktopPatrolSummary: async () => ({
      promotionApproval: {
        latestProposalId: 'prop_903',
        approvalStage: 'code_apply_task',
        approvalStatus: 'ready_for_human_code_apply_task',
        branchName: 'codex/desktop-prop-903',
        worktreeRef: { path: '/tmp/member-desktop-prop-903' }
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposalId, 'prop_903');
  assert.equal(result.approvalStage, 'code_apply_task');
  assert.equal(result.nextArtifactKind, 'code_apply_signoff');
  assert.equal(result.expectedReadyStatus, 'ready_for_human_apply_signoff');
  assert.equal(result.script, 'line-desktop-patrol:synthesize-code-apply-signoff');
  assert.equal(result.moduleName, 'member_line_patrol.synthesize_code_apply_signoff');
  assert.equal(
    result.command,
    'npm run line-desktop-patrol:synthesize-code-apply-signoff -- --proposal-id prop_903 --branch-name codex/desktop-prop-903 --worktree-path /tmp/member-desktop-prop-903'
  );
  assert.match(result.planHash, /^desktopapproval_[a-f0-9]{24}$/);
  assert.equal(typeof result.confirmToken, 'string');
  assert.ok(result.confirmToken.length > 20);
});

test('phase903: approval plan blocks when latest operator lane does not match the requested proposal', async () => {
  await assert.rejects(() => {
    return planDesktopPatrolApprovalAction({
      proposalId: 'prop_old'
    }, {
      queryLatestDesktopPatrolSummary: async () => ({
        promotionApproval: {
          latestProposalId: 'prop_latest',
          approvalStage: 'patch_request',
          approvalStatus: 'ready_for_human_patch'
        }
      })
    });
  }, (err) => {
    assert.equal(err && err.code, 'desktop_patrol_approval_latest_mismatch');
    assert.equal(err && err.statusCode, 409);
    return true;
  });
});
