'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { resolvePlan, resolveAllowedIntent, normalizeIntentName } = require('./planGate');

const GLOBAL_QPS_WINDOW_MS = 1000;
const globalRequestTimestamps = [];

function sweepGlobalWindow(nowMs) {
  while (globalRequestTimestamps.length > 0 && nowMs - globalRequestTimestamps[0] > GLOBAL_QPS_WINDOW_MS) {
    globalRequestTimestamps.shift();
  }
}

function reserveGlobalQpsSlot(limit, nowMs) {
  const bounded = Number(limit);
  if (!Number.isFinite(bounded) || bounded <= 0) return true;
  sweepGlobalWindow(nowMs);
  if (globalRequestTimestamps.length >= Math.floor(bounded)) return false;
  globalRequestTimestamps.push(nowMs);
  return true;
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildBlockedDecision(base, reason) {
  return Object.assign({}, base, {
    allowed: false,
    decision: 'blocked',
    blockedReason: reason
  });
}

async function evaluateLLMBudget(lineUserId, params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const intent = normalizeIntentName(payload.intent || 'faq_search') || 'faq_search';
  const tokenEstimate = Math.max(0, toNumber(payload.tokenEstimate, 0));
  const planInfo = payload.planInfo || await resolvePlan(lineUserId, resolvedDeps);
  const policy = payload.policy || await (resolvedDeps.opsConfigRepo || opsConfigRepo).getLlmPolicy();

  const base = {
    allowed: true,
    decision: 'allow',
    blockedReason: null,
    plan: planInfo.plan,
    status: planInfo.status,
    intent,
    tokenUsed: tokenEstimate,
    policy
  };

  if (!lineUserId || typeof lineUserId !== 'string' || !lineUserId.trim()) {
    return buildBlockedDecision(base, 'user_missing');
  }

  if (!policy || policy.enabled !== true) {
    return buildBlockedDecision(base, 'policy_disabled');
  }

  const envFlag = isLlmFeatureEnabled(process.env);
  const llmEnabled = await (resolvedDeps.systemFlagsRepo || systemFlagsRepo).getLlmEnabled().catch(() => false);
  if (!envFlag || !llmEnabled) {
    return buildBlockedDecision(base, 'llm_disabled');
  }

  const allowed = await resolveAllowedIntent(planInfo.plan, { policy, opsConfigRepo: resolvedDeps.opsConfigRepo || opsConfigRepo });
  if (!allowed.allowedIntents.includes(intent)) {
    return buildBlockedDecision(base, 'intent_not_allowed');
  }

  if (planInfo.plan !== 'pro' && intent !== 'faq_search') {
    return buildBlockedDecision(base, 'plan_free');
  }

  const stats = await (resolvedDeps.llmUsageStatsRepo || llmUsageStatsRepo).getUserUsageStats(lineUserId).catch(() => null);
  if (stats) {
    const dailyLimit = toNumber(policy.per_user_daily_limit, 0);
    if (dailyLimit > 0 && toNumber(stats.dailyUsageCount, 0) >= dailyLimit) {
      return buildBlockedDecision(base, 'daily_limit_exceeded');
    }

    const tokenBudgetSource = Object.prototype.hasOwnProperty.call(policy, 'per_user_token_budget')
      ? policy.per_user_token_budget
      : policy.per_user_daily_token_budget;
    const tokenBudget = toNumber(tokenBudgetSource, 0);
    if (tokenBudget > 0 && (toNumber(stats.dailyTokenUsed, 0) + tokenEstimate) > tokenBudget) {
      return buildBlockedDecision(base, 'token_budget_exceeded');
    }
  }

  const nowMs = Date.now();
  if (!reserveGlobalQpsSlot(policy.global_qps_limit, nowMs)) {
    return buildBlockedDecision(base, 'global_qps_exceeded');
  }

  return base;
}

module.exports = {
  evaluateLLMBudget,
  __testOnly: {
    sweepGlobalWindow,
    globalRequestTimestamps
  }
};
