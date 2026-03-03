'use strict';

const crypto = require('crypto');
const usersRepo = require('../../repos/firestore/usersRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const { computeUserTasks } = require('./computeUserTasks');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function createUsecaseError(code, statusCode, details) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  if (details && typeof details === 'object') err.details = details;
  return err;
}

async function resolveSingleUser(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const users = resolvedDeps.usersRepo || usersRepo;

  const directLineUserId = normalizeText(payload.lineUserId || payload.userId, '');
  if (directLineUserId) {
    return {
      lineUserId: directLineUserId,
      resolvedBy: 'lineUserId',
      resolvedUsers: [directLineUserId]
    };
  }

  const memberNumber = normalizeText(payload.memberNumber, '');
  if (!memberNumber) {
    throw createUsecaseError('lineUserId_or_memberNumber_required', 400);
  }

  const matchedUsers = await users.listUsersByMemberNumber(memberNumber, 20);
  const resolvedUsers = matchedUsers
    .map((user) => (user && typeof user.id === 'string' ? user.id : null))
    .filter(Boolean);

  if (resolvedUsers.length === 0) {
    throw createUsecaseError('user_not_found', 404, { memberNumber, resolvedUsers: [] });
  }
  if (resolvedUsers.length > 1) {
    throw createUsecaseError('multiple_users', 409, { memberNumber, resolvedUsers });
  }

  return {
    lineUserId: resolvedUsers[0],
    resolvedBy: 'memberNumber',
    resolvedUsers
  };
}

function buildApplyPlanHash(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const normalizedTasks = tasks.map((task) => ({
    taskId: task.taskId || null,
    ruleId: task.ruleId || null,
    status: task.status || null,
    blockedReason: task.blockedReason || null,
    decisionHash: task.decisionHash || null
  }));
  const basis = {
    lineUserId: payload.lineUserId || null,
    now: payload.now || null,
    taskCount: normalizedTasks.length,
    tasks: normalizedTasks
  };
  return `taskrules_apply_${crypto.createHash('sha256').update(JSON.stringify(basis), 'utf8').digest('hex').slice(0, 24)}`;
}

function summarizeComputed(result) {
  const computed = result && typeof result === 'object' ? result : {};
  const tasks = Array.isArray(computed.tasks) ? computed.tasks : [];
  const blocked = Array.isArray(computed.blocked) ? computed.blocked : [];
  const explain = Array.isArray(computed.explain) ? computed.explain : [];
  const decisions = Array.isArray(computed.decisions) ? computed.decisions : [];
  const changed = decisions.filter((item) => item && item.decisionKey && item.decisionKey !== 'noop');
  return {
    taskCount: tasks.length,
    blockedCount: blocked.length,
    explainCount: explain.length,
    changedCount: changed.length,
    createCount: changed.filter((item) => item.decisionKey === 'create').length,
    updateCount: changed.filter((item) => item.decisionKey === 'update').length
  };
}

async function planTaskRulesApply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const userResolution = await resolveSingleUser(payload, resolvedDeps);
  const lineUserId = userResolution.lineUserId;
  const nowIso = toIso(payload.now) || new Date().toISOString();

  const rulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const stepRules = Array.isArray(payload.stepRules)
    ? payload.stepRules
    : await rulesRepository.listEnabledStepRulesNow({
      now: nowIso,
      limit: 1000
    });

  const computed = await computeUserTasks({
    userId: lineUserId,
    lineUserId,
    now: nowIso,
    stepRules,
    killSwitch: payload.killSwitch
  }, resolvedDeps);

  const planHash = buildApplyPlanHash({
    lineUserId,
    now: computed.now,
    tasks: computed.tasks
  });

  return {
    ok: true,
    lineUserId,
    resolvedBy: userResolution.resolvedBy,
    resolvedUsers: userResolution.resolvedUsers,
    memberNumber: normalizeText(payload.memberNumber, null),
    now: computed.now,
    stepRules,
    computed,
    planHash,
    summary: summarizeComputed(computed)
  };
}

module.exports = {
  planTaskRulesApply,
  resolveSingleUser,
  buildApplyPlanHash,
  createUsecaseError
};
