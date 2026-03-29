'use strict';

const { createConfirmToken } = require('../../domain/confirmToken');
const {
  resolvePromotionApprovalExecutionDescriptor,
  buildPromotionApprovalCommand,
  computePromotionApprovalPlanHash,
  buildPromotionApprovalConfirmTokenData
} = require('../../domain/qualityPatrol/desktopApprovalFlow');
const { queryLatestDesktopPatrolSummary } = require('./queryLatestDesktopPatrolSummary');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function buildKnownError(statusCode, code, details) {
  const err = new Error(code);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details && typeof details === 'object' ? details : {};
  return err;
}

async function planDesktopPatrolApprovalAction(input, deps) {
  const params = input && typeof input === 'object' ? input : {};
  const queryUsecase = deps && typeof deps.queryLatestDesktopPatrolSummary === 'function'
    ? deps.queryLatestDesktopPatrolSummary
    : queryLatestDesktopPatrolSummary;
  const summary = await queryUsecase({ audience: 'operator' }, deps);
  const approval = summary && summary.promotionApproval && typeof summary.promotionApproval === 'object'
    ? summary.promotionApproval
    : null;

  if (!approval || !normalizeText(approval.latestProposalId, '')) {
    throw buildKnownError(409, 'desktop_patrol_approval_unavailable', {
      expected: 'latest operator approval lane',
      status: summary && summary.status ? summary.status : null,
      stage: summary && summary.stage ? summary.stage : null
    });
  }

  const latestProposalId = normalizeText(approval.latestProposalId, '');
  const proposalId = normalizeText(params.proposalId, latestProposalId);
  if (proposalId !== latestProposalId) {
    throw buildKnownError(409, 'desktop_patrol_approval_latest_mismatch', {
      proposalId,
      latestProposalId
    });
  }

  const descriptor = resolvePromotionApprovalExecutionDescriptor(approval.approvalStage, approval.approvalStatus);
  if (!descriptor) {
    throw buildKnownError(409, 'desktop_patrol_approval_no_next_action', {
      proposalId,
      approvalStage: approval.approvalStage || null,
      approvalStatus: approval.approvalStatus || null
    });
  }

  const branchName = normalizeText(params.branchName, normalizeText(approval.branchName, null));
  const worktreePath = normalizeText(
    params.worktreePath,
    approval.worktreeRef && typeof approval.worktreeRef === 'object'
      ? normalizeText(approval.worktreeRef.path, null)
      : null
  );
  const command = buildPromotionApprovalCommand(descriptor.script, proposalId, branchName, worktreePath);
  const plan = {
    ok: true,
    proposalId,
    approvalStage: descriptor.stage,
    approvalStatus: normalizeText(approval.approvalStatus, null),
    nextArtifactKind: descriptor.nextArtifactKind,
    expectedReadyStatus: descriptor.expectedReadyStatus,
    command,
    script: descriptor.script,
    moduleName: descriptor.moduleName,
    branchName,
    worktreePath
  };
  const planHash = computePromotionApprovalPlanHash(plan);
  const confirmToken = createConfirmToken(buildPromotionApprovalConfirmTokenData(planHash), { now: new Date() });

  return Object.assign({}, plan, {
    planHash,
    confirmToken
  });
}

module.exports = {
  planDesktopPatrolApprovalAction
};
