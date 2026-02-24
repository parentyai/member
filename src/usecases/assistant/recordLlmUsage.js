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

  const logResult = await llmUsageLogsRepo.appendLlmUsageLog({
    userId: payload.userId,
    intent: payload.intent,
    plan: payload.plan,
    subscriptionStatus: payload.subscriptionStatus,
    decision: payload.decision,
    blockedReason: payload.blockedReason || null,
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
    stats
  };
}

module.exports = {
  MODEL_PRICING_USD_PER_MILLION,
  estimateCost,
  recordLlmUsage
};
