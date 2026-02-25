'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const llmPolicyChangeLogsRepo = require('../../repos/firestore/llmPolicyChangeLogsRepo');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function serializePolicy(policy) {
  const payload = policy && typeof policy === 'object' ? policy : {};
  return JSON.stringify({
    enabled: payload.enabled === true,
    model: payload.model,
    temperature: payload.temperature,
    top_p: payload.top_p,
    max_output_tokens: payload.max_output_tokens,
    per_user_daily_limit: payload.per_user_daily_limit,
    per_user_token_budget: payload.per_user_token_budget,
    global_qps_limit: payload.global_qps_limit,
    cache_ttl_sec: payload.cache_ttl_sec,
    allowed_intents_free: Array.isArray(payload.allowed_intents_free) ? payload.allowed_intents_free : [],
    allowed_intents_pro: Array.isArray(payload.allowed_intents_pro) ? payload.allowed_intents_pro : [],
    safety_mode: payload.safety_mode
  });
}

function computePlanHash(policy) {
  const text = `llmPolicy=${serializePolicy(policy)}`;
  return `llmpolicy_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'llm_policy',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function buildCandidatePolicy(basePolicy, policyPatch) {
  const patch = policyPatch && typeof policyPatch === 'object' ? policyPatch : {};
  const candidate = Object.assign({}, basePolicy, patch);
  if (
    Object.prototype.hasOwnProperty.call(patch, 'max_tokens')
    && !Object.prototype.hasOwnProperty.call(patch, 'max_output_tokens')
  ) {
    candidate.max_output_tokens = patch.max_tokens;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'per_user_limit')
    && !Object.prototype.hasOwnProperty.call(patch, 'per_user_daily_limit')
  ) {
    candidate.per_user_daily_limit = patch.per_user_limit;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'rate_limit')
    && !Object.prototype.hasOwnProperty.call(patch, 'global_qps_limit')
  ) {
    candidate.global_qps_limit = patch.rate_limit;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'per_user_daily_token_budget')
    && !Object.prototype.hasOwnProperty.call(patch, 'per_user_token_budget')
  ) {
    candidate.per_user_token_budget = patch.per_user_daily_token_budget;
  }
  return candidate;
}

function resolveCanonicalizationInfo(sourcePolicy, normalized) {
  const src = sourcePolicy && typeof sourcePolicy === 'object' ? sourcePolicy : {};
  const listHasAlias = (value) => Array.isArray(value) && value.some((item) => String(item || '').trim().toLowerCase() === 'next_action');
  const freeAliasInput = listHasAlias(src.allowed_intents_free);
  const proAliasInput = listHasAlias(src.allowed_intents_pro);
  const tokenBudgetAliasInput = Object.prototype.hasOwnProperty.call(src, 'per_user_daily_token_budget')
    && !Object.prototype.hasOwnProperty.call(src, 'per_user_token_budget');
  const maxTokensAliasInput = Object.prototype.hasOwnProperty.call(src, 'max_tokens')
    && !Object.prototype.hasOwnProperty.call(src, 'max_output_tokens');
  const perUserLimitAliasInput = Object.prototype.hasOwnProperty.call(src, 'per_user_limit')
    && !Object.prototype.hasOwnProperty.call(src, 'per_user_daily_limit');
  const rateLimitAliasInput = Object.prototype.hasOwnProperty.call(src, 'rate_limit')
    && !Object.prototype.hasOwnProperty.call(src, 'global_qps_limit');
  return {
    intentAliasApplied: freeAliasInput || proAliasInput,
    intentAliasAppliedFree: freeAliasInput,
    intentAliasAppliedPro: proAliasInput,
    tokenBudgetAliasApplied: tokenBudgetAliasInput,
    maxTokensAliasApplied: maxTokensAliasInput,
    perUserLimitAliasApplied: perUserLimitAliasInput,
    rateLimitAliasApplied: rateLimitAliasInput,
    normalizedPolicy: normalized
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const [llmPolicy, systemLlmEnabled] = await Promise.all([
    opsConfigRepo.getLlmPolicy(),
    systemFlagsRepo.getLlmEnabled()
  ]);
  const envFlag = isLlmFeatureEnabled(process.env);
  const effectiveEnabled = Boolean(llmPolicy.enabled && systemLlmEnabled && envFlag);

  await appendAuditLog({
    actor,
    action: 'llm_policy.status.view',
    entityType: 'opsConfig',
    entityId: 'llmPolicy',
    traceId,
    requestId,
    payloadSummary: {
      effectiveEnabled,
      systemLlmEnabled,
      envFlag,
      llmPolicy
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    llmPolicy,
    systemLlmEnabled,
    envFlag,
    effectiveEnabled,
    serverTime: new Date().toISOString()
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const basePolicy = await opsConfigRepo.getLlmPolicy();
  const candidate = payload.policy === undefined
    ? basePolicy
    : buildCandidatePolicy(basePolicy, payload.policy);
  const normalized = opsConfigRepo.normalizeLlmPolicy(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid llmPolicy', traceId, requestId }));
    return;
  }
  const canonicalization = resolveCanonicalizationInfo(payload.policy, normalized);

  const planHash = computePlanHash(normalized);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'llm_policy.plan',
    entityType: 'opsConfig',
    entityId: 'llmPolicy',
    traceId,
    requestId,
    payloadSummary: {
      planHash,
      llmPolicy: normalized,
      canonicalization
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    llmPolicy: normalized,
    canonicalization,
    planHash,
    confirmToken,
    serverTime: new Date().toISOString()
  }));
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const basePolicy = await opsConfigRepo.getLlmPolicy();
  const candidate = payload.policy === undefined
    ? basePolicy
    : buildCandidatePolicy(basePolicy, payload.policy);
  const normalized = opsConfigRepo.normalizeLlmPolicy(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid llmPolicy', traceId, requestId }));
    return;
  }
  const canonicalization = resolveCanonicalizationInfo(payload.policy, normalized);

  const planHash = typeof payload.planHash === 'string' ? payload.planHash.trim() : '';
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken.trim() : '';
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId, requestId }));
    return;
  }

  const expectedPlanHash = computePlanHash(normalized);
  if (expectedPlanHash !== planHash) {
    await appendAuditLog({
      actor,
      action: 'llm_policy.set',
      entityType: 'opsConfig',
      entityId: 'llmPolicy',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        expectedPlanHash,
        planHash,
        canonicalization
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }

  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    await appendAuditLog({
      actor,
      action: 'llm_policy.set',
      entityType: 'opsConfig',
      entityId: 'llmPolicy',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch'
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  const saved = await opsConfigRepo.setLlmPolicy(normalized, actor);
  await llmPolicyChangeLogsRepo.appendLlmPolicyChangeLog({
    actor,
    traceId,
    requestId,
    planHash,
    policy: saved,
    canonicalization,
    createdAt: new Date().toISOString()
  }).catch(() => null);
  await appendAuditLog({
    actor,
    action: 'llm_policy.set',
    entityType: 'opsConfig',
    entityId: 'llmPolicy',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      llmPolicy: saved,
      canonicalization
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    llmPolicy: saved,
    canonicalization,
    serverTime: new Date().toISOString()
  }));
}

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit') || 20);
  if (!Number.isFinite(raw) || raw < 1) return 20;
  return Math.min(Math.floor(raw), 100);
}

async function handleHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);

  const items = await llmPolicyChangeLogsRepo.listLlmPolicyChangeLogs(limit).catch(() => []);
  await appendAuditLog({
    actor,
    action: 'llm_policy.history.view',
    entityType: 'opsConfig',
    entityId: 'llmPolicy',
    traceId,
    requestId,
    payloadSummary: {
      limit,
      count: items.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    limit,
    items
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet,
  handleHistory
};
