'use strict';

const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');

const MODEL_PRICING_USD_PER_MILLION = Object.freeze({
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 }
});

function normalizeModelKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function estimateCost(model, tokensIn, tokensOut) {
  const key = normalizeModelKey(model);
  const pricing = MODEL_PRICING_USD_PER_MILLION[key];
  if (!pricing) return null;
  const inCost = (Math.max(0, tokensIn) / 1000000) * pricing.input;
  const outCost = (Math.max(0, tokensOut) / 1000000) * pricing.output;
  const total = inCost + outCost;
  return Number(total.toFixed(8));
}

function classifyBlockedReasonCategory(reason) {
  const normalized = typeof reason === 'string' ? reason.trim().toLowerCase() : '';
  if (!normalized) return null;
  if (
    normalized.includes('daily_limit')
    || normalized.includes('token_budget')
    || normalized.includes('qps')
    || normalized.includes('budget')
  ) {
    return 'budget';
  }
  if (normalized.includes('plan') || normalized.includes('intent_not_allowed')) {
    return 'plan';
  }
  if (
    normalized.includes('citation')
    || normalized.includes('template')
    || normalized.includes('section_limit')
    || normalized.includes('invalid_schema')
  ) {
    return 'quality';
  }
  if (
    normalized.includes('timeout')
    || normalized.includes('llm_error')
    || normalized.includes('outage')
    || normalized.includes('disabled')
    || normalized.includes('adapter_missing')
  ) {
    return 'availability';
  }
  return 'other';
}

async function recordLlmUsage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const tokensIn = Math.max(0, toNumber(payload.tokensIn, 0));
  const tokensOut = Math.max(0, toNumber(payload.tokensOut, 0));
  const tokenUsed = Math.max(0, toNumber(payload.tokenUsed, tokensIn + tokensOut));
  const model = typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : null;
  const costEstimate = Number.isFinite(Number(payload.costEstimate))
    ? Number(payload.costEstimate)
    : estimateCost(model, tokensIn, tokensOut);
  const createdAt = payload.createdAt || new Date().toISOString();
  const blockedReasonCategory = payload.blockedReasonCategory || classifyBlockedReasonCategory(payload.blockedReason);

  const logResult = await llmUsageLogsRepo.appendLlmUsageLog({
    userId: payload.userId,
    intent: payload.intent,
    plan: payload.plan,
    subscriptionStatus: payload.subscriptionStatus,
    decision: payload.decision,
    blockedReason: payload.blockedReason || null,
    blockedReasonCategory: blockedReasonCategory || null,
    tokensIn,
    tokensOut,
    tokenUsed,
    costEstimate,
    model,
    createdAt
  });

  const stats = await llmUsageStatsRepo.incrementUserUsageStats({
    lineUserId: payload.userId,
    tokensIn,
    tokensOut,
    tokenUsed,
    decision: payload.decision,
    blockedReason: payload.blockedReason || null,
    createdAt
  });

  return {
    ok: true,
    logId: logResult && logResult.id ? logResult.id : null,
    costEstimate,
    blockedReasonCategory: blockedReasonCategory || null,
    stats
  };
}

module.exports = {
  MODEL_PRICING_USD_PER_MILLION,
  estimateCost,
  recordLlmUsage
};
