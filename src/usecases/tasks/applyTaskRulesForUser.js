'use strict';

const { syncUserTasksProjection } = require('./syncUserTasksProjection');
const { planTaskRulesApply } = require('./planTaskRulesApply');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function createUsecaseError(code, statusCode, details) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  if (details && typeof details === 'object') err.details = details;
  return err;
}

async function applyTaskRulesForUser(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const planned = await planTaskRulesApply(payload, resolvedDeps);
  const expectedPlanHash = planned.planHash;
  const providedPlanHash = normalizeText(payload.planHash, '');

  if (providedPlanHash && providedPlanHash !== expectedPlanHash) {
    throw createUsecaseError('plan_hash_mismatch', 409, { expectedPlanHash });
  }

  const syncResult = await syncUserTasksProjection({
    userId: planned.lineUserId,
    lineUserId: planned.lineUserId,
    now: planned.now,
    actor: payload.actor || 'task_rules_apply',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    computed: planned.computed
  }, resolvedDeps);

  return {
    ok: true,
    lineUserId: planned.lineUserId,
    resolvedBy: planned.resolvedBy,
    resolvedUsers: planned.resolvedUsers,
    memberNumber: planned.memberNumber,
    now: planned.now,
    planHash: expectedPlanHash,
    summary: planned.summary,
    sync: syncResult
  };
}

module.exports = {
  applyTaskRulesForUser
};
