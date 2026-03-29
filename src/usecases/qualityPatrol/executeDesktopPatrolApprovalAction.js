'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { planDesktopPatrolApprovalAction } = require('./planDesktopPatrolApprovalAction');
const { queryLatestDesktopPatrolSummary } = require('./queryLatestDesktopPatrolSummary');

const execFileAsync = promisify(execFile);

function buildKnownError(statusCode, code, details) {
  const err = new Error(code);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details && typeof details === 'object' ? details : {};
  return err;
}

function resolveRepoRoot(deps) {
  const fromDeps = deps && typeof deps.repoRoot === 'string' && deps.repoRoot.trim()
    ? deps.repoRoot.trim()
    : process.cwd();
  return path.resolve(fromDeps);
}

function isLocalDesktopApprovalExecutionAllowed() {
  if (process.env.NODE_ENV === 'test') return true;
  const envName = typeof process.env.ENV_NAME === 'string' ? process.env.ENV_NAME.trim() : '';
  return !envName || envName === 'local';
}

function buildPythonArgs(plan, repoRoot) {
  const args = [
    '-m',
    plan.moduleName,
    '--proposal-id',
    plan.proposalId,
    '--queue-root',
    'artifacts/line_desktop_patrol/proposals',
    '--repo-root',
    repoRoot
  ];
  if (plan.branchName) args.push('--branch-name', plan.branchName);
  if (plan.worktreePath) args.push('--worktree-path', plan.worktreePath);
  return args;
}

function parseCommandJson(output, details) {
  const trimmed = String(output || '').trim();
  if (!trimmed) {
    throw buildKnownError(500, 'desktop_patrol_approval_empty_output', details);
  }
  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    throw buildKnownError(500, 'desktop_patrol_approval_invalid_output', Object.assign({}, details, {
      stdout: trimmed
    }));
  }
}

async function executeDesktopPatrolApprovalAction(input, deps) {
  if (!isLocalDesktopApprovalExecutionAllowed()) {
    throw buildKnownError(409, 'desktop_patrol_approval_local_only', {
      envName: process.env.ENV_NAME || null
    });
  }

  const params = input && typeof input === 'object' ? input : {};
  const plan = params.plan && typeof params.plan === 'object'
    ? params.plan
    : await planDesktopPatrolApprovalAction(params, deps);
  if (!plan || !plan.ok) {
    throw buildKnownError(500, 'desktop_patrol_approval_plan_invalid', {});
  }
  if (params.planHash && params.planHash !== plan.planHash) {
    throw buildKnownError(409, 'desktop_patrol_approval_plan_stale', {
      planHash: params.planHash,
      expectedPlanHash: plan.planHash
    });
  }

  const repoRoot = resolveRepoRoot(deps);
  const runner = deps && typeof deps.execFile === 'function' ? deps.execFile : execFileAsync;
  const args = buildPythonArgs(plan, repoRoot);
  const env = Object.assign({}, process.env, {
    PYTHONPATH: path.resolve(repoRoot, 'tools', 'line_desktop_patrol', 'src')
  });
  const details = {
    command: `python3 ${args.join(' ')}`,
    repoRoot,
    proposalId: plan.proposalId,
    approvalStage: plan.approvalStage
  };

  let rawResult;
  try {
    rawResult = await runner('python3', args, {
      cwd: repoRoot,
      env,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    throw buildKnownError(500, 'desktop_patrol_approval_exec_failed', Object.assign({}, details, {
      stderr: error && typeof error.stderr === 'string' ? error.stderr.trim() : null,
      stdout: error && typeof error.stdout === 'string' ? error.stdout.trim() : null
    }));
  }

  const stdout = rawResult && typeof rawResult.stdout === 'string' ? rawResult.stdout : '';
  const result = parseCommandJson(stdout, details);
  const queryUsecase = deps && typeof deps.queryLatestDesktopPatrolSummary === 'function'
    ? deps.queryLatestDesktopPatrolSummary
    : queryLatestDesktopPatrolSummary;
  const desktopPatrolSummary = await queryUsecase({ audience: 'operator' }, deps);

  return {
    ok: true,
    proposalId: plan.proposalId,
    approvalStage: plan.approvalStage,
    approvalStatus: plan.approvalStatus || null,
    nextArtifactKind: plan.nextArtifactKind,
    expectedReadyStatus: plan.expectedReadyStatus || null,
    planHash: plan.planHash || null,
    command: plan.command || null,
    executionResult: result,
    desktopPatrolSummary
  };
}

module.exports = {
  executeDesktopPatrolApprovalAction
};
