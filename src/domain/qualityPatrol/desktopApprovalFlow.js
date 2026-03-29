'use strict';

const crypto = require('crypto');

const PROMOTION_APPROVAL_ARTIFACT_ORDER = Object.freeze([
  { kind: 'patch_request', jsonSuffix: '.patch_request.json' },
  { kind: 'code_apply_task', jsonSuffix: '.code_apply_task.json' },
  { kind: 'code_apply_signoff', jsonSuffix: '.code_apply_signoff.json' },
  { kind: 'code_apply_record', jsonSuffix: '.code_apply_record.json' }
]);

const PROMOTION_APPROVAL_COMMAND_ORDER = Object.freeze([
  {
    stage: 'patch_request',
    script: 'line-desktop-patrol:synthesize-code-apply-task',
    moduleName: 'member_line_patrol.synthesize_code_apply_task',
    nextArtifactKind: 'code_apply_task',
    expectedReadyStatus: 'ready_for_human_code_apply_task'
  },
  {
    stage: 'code_apply_task',
    script: 'line-desktop-patrol:synthesize-code-apply-signoff',
    moduleName: 'member_line_patrol.synthesize_code_apply_signoff',
    nextArtifactKind: 'code_apply_signoff',
    expectedReadyStatus: 'ready_for_human_apply_signoff'
  },
  {
    stage: 'code_apply_signoff',
    script: 'line-desktop-patrol:synthesize-code-apply-record',
    moduleName: 'member_line_patrol.synthesize_code_apply_record',
    nextArtifactKind: 'code_apply_record',
    expectedReadyStatus: 'ready_for_human_apply_record'
  }
]);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function resolvePromotionApprovalStage(stage, status) {
  const normalizedStage = normalizeText(stage, null);
  if (normalizedStage) return normalizedStage;
  const normalizedStatus = normalizeText(status, null);
  if (normalizedStatus === 'ready_for_human_apply_record') return 'code_apply_record';
  if (normalizedStatus === 'ready_for_human_apply_signoff') return 'code_apply_signoff';
  if (normalizedStatus === 'ready_for_human_code_apply_task') return 'code_apply_task';
  if (normalizedStatus === 'ready_for_human_patch') return 'patch_request';
  return null;
}

function buildPromotionApprovalNextAction(stage, status) {
  const normalizedStage = resolvePromotionApprovalStage(stage, status);
  const normalizedStatus = normalizeText(status, null);
  if (normalizedStage === 'code_apply_record' || normalizedStatus === 'ready_for_human_apply_record') {
    return 'Review the final apply record and close the proposal loop.';
  }
  if (normalizedStage === 'code_apply_signoff' || normalizedStatus === 'ready_for_human_apply_signoff') {
    return 'Review the signoff bundle and capture the final go or no-go decision.';
  }
  if (normalizedStage === 'code_apply_task' || normalizedStatus === 'ready_for_human_code_apply_task') {
    return 'Review the code apply task and run the prepared validation plan.';
  }
  if (normalizedStage === 'patch_request' || normalizedStatus === 'ready_for_human_patch') {
    return 'Review the patch request and prepare the code apply task bundle.';
  }
  return null;
}

function buildPromotionApprovalCommand(script, proposalId, branchName, worktreePath) {
  const normalizedScript = normalizeText(script, null);
  const normalizedProposalId = normalizeText(proposalId, null);
  if (!normalizedScript || !normalizedProposalId) return null;
  const parts = [
    'npm',
    'run',
    normalizedScript,
    '--',
    '--proposal-id',
    normalizedProposalId
  ];
  const normalizedBranchName = normalizeText(branchName, null);
  const normalizedWorktreePath = normalizeText(worktreePath, null);
  if (normalizedBranchName) parts.push('--branch-name', normalizedBranchName);
  if (normalizedWorktreePath) parts.push('--worktree-path', normalizedWorktreePath);
  return parts.join(' ');
}

function resolvePromotionApprovalExecutionDescriptor(stage, status) {
  const normalizedStage = resolvePromotionApprovalStage(stage, status);
  if (!normalizedStage) return null;
  const descriptor = PROMOTION_APPROVAL_COMMAND_ORDER.find((item) => item.stage === normalizedStage);
  return descriptor ? Object.freeze(Object.assign({}, descriptor)) : null;
}

function buildPromotionApprovalCommandHints(stage, status, proposalId, branchName, worktreePath, audience) {
  const descriptor = resolvePromotionApprovalExecutionDescriptor(stage, status);
  const startIndex = descriptor
    ? PROMOTION_APPROVAL_COMMAND_ORDER.findIndex((item) => item.stage === descriptor.stage)
    : -1;
  const descriptors = startIndex >= 0
    ? PROMOTION_APPROVAL_COMMAND_ORDER.slice(startIndex)
    : [];
  const commands = descriptors
    .map((item) => buildPromotionApprovalCommand(item.script, proposalId, branchName, worktreePath))
    .filter(Boolean);
  return {
    nextCommand: audience === 'operator' ? commands[0] || null : null,
    remainingCommands: audience === 'operator' ? commands : [],
    remainingCommandCount: commands.length
  };
}

function computePromotionApprovalPlanHash(plan) {
  const payload = {
    proposalId: normalizeText(plan && plan.proposalId, null),
    approvalStage: resolvePromotionApprovalStage(plan && plan.approvalStage, plan && plan.approvalStatus),
    approvalStatus: normalizeText(plan && plan.approvalStatus, null),
    nextArtifactKind: normalizeText(plan && plan.nextArtifactKind, null),
    branchName: normalizeText(plan && plan.branchName, null),
    worktreePath: normalizeText(plan && plan.worktreePath, null),
    command: normalizeText(plan && plan.command, null)
  };
  return `desktopapproval_${crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24)}`;
}

function buildPromotionApprovalConfirmTokenData(planHash) {
  return {
    planHash: normalizeText(planHash, ''),
    templateKey: 'desktop_patrol_approval',
    templateVersion: '',
    segmentKey: 'qualityPatrol'
  };
}

module.exports = {
  PROMOTION_APPROVAL_ARTIFACT_ORDER,
  PROMOTION_APPROVAL_COMMAND_ORDER,
  resolvePromotionApprovalStage,
  buildPromotionApprovalNextAction,
  buildPromotionApprovalCommand,
  buildPromotionApprovalCommandHints,
  resolvePromotionApprovalExecutionDescriptor,
  computePromotionApprovalPlanHash,
  buildPromotionApprovalConfirmTokenData
};
