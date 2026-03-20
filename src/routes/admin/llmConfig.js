'use strict';

const crypto = require('crypto');

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { getLlmRuntimeState } = require('../../infra/llm/runtimeState');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const STATUS_ROUTE_KEY = 'admin.llm_config_status';
const PLAN_ROUTE_KEY = 'admin.llm_config_plan';
const SET_ROUTE_KEY = 'admin.llm_config_set';

function normalizeLlmEnabled(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('llmEnabled required');
}

function normalizeLlmConciergeEnabled(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('llmConciergeEnabled invalid');
}

function normalizeLlmWebSearchEnabled(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('llmWebSearchEnabled invalid');
}

function normalizeLlmStyleEngineEnabled(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('llmStyleEngineEnabled invalid');
}

function normalizeLlmBanditEnabled(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('llmBanditEnabled invalid');
}

function normalizeLlmPolicy(value, fallback) {
  if (value === undefined) return fallback;
  const normalized = systemFlagsRepo.normalizeLlmPolicy(value);
  if (normalized === null) throw new Error('invalid llmPolicy');
  return normalized;
}

function serializeLlmPolicy(policy) {
  return JSON.stringify({
    lawfulBasis: policy.lawfulBasis,
    consentVerified: Boolean(policy.consentVerified),
    crossBorder: Boolean(policy.crossBorder)
  });
}

function computePlanHash(llmEnabled, llmPolicy, llmConciergeEnabled, llmWebSearchEnabled, llmStyleEngineEnabled, llmBanditEnabled) {
  const text = [
    `llmEnabled=${llmEnabled ? 'true' : 'false'}`,
    `llmPolicy=${serializeLlmPolicy(llmPolicy)}`,
    `llmConciergeEnabled=${llmConciergeEnabled ? 'true' : 'false'}`,
    `llmWebSearchEnabled=${llmWebSearchEnabled ? 'true' : 'false'}`,
    `llmStyleEngineEnabled=${llmStyleEngineEnabled ? 'true' : 'false'}`,
    `llmBanditEnabled=${llmBanditEnabled ? 'true' : 'false'}`
  ].join(';');
  return `llmcfg_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function envFlagEnabled(name, fallback) {
  const raw = typeof process.env[name] === 'string' ? process.env[name].trim().toLowerCase() : '';
  if (!raw) return fallback === true;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  return fallback === true;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'llm_config',
    templateVersion: '',
    segmentKey: 'phase0'
  };
}

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function normalizeReason(message, fallback) {
  const text = typeof message === 'string' ? message : '';
  const normalized = text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return normalized || fallback;
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const [llmEnabled, llmConciergeEnabled, llmWebSearchEnabled, llmStyleEngineEnabled, llmBanditEnabled] = await Promise.all([
    systemFlagsRepo.getLlmEnabled(),
    systemFlagsRepo.getLlmConciergeEnabled(),
    systemFlagsRepo.getLlmWebSearchEnabled(),
    systemFlagsRepo.getLlmStyleEngineEnabled(),
    systemFlagsRepo.getLlmBanditEnabled()
  ]);
  const llmPolicy = await systemFlagsRepo.getLlmPolicy();
  const envEnabled = isLlmFeatureEnabled(process.env);
  const envWebSearchAvailable = (() => {
    const provider = typeof process.env.WEB_SEARCH_PROVIDER === 'string'
      ? process.env.WEB_SEARCH_PROVIDER.trim().toLowerCase()
      : '';
    if (!provider || provider === 'none' || provider === 'disabled') return false;
    return true;
  })();
  const envStyleEngineAvailable = envFlagEnabled('STYLE_ENGINE_ENABLED', true);
  const envBanditAvailable = envFlagEnabled('BANDIT_ENABLED', true);
  const runtimeState = getLlmRuntimeState({
    envFlag: envEnabled,
    systemFlag: llmEnabled,
    blockedReason: null
  });
  const effectiveEnabled = runtimeState.effectiveEnabled;
  const effectiveConciergeEnabled = Boolean(llmEnabled && llmConciergeEnabled && envEnabled);
  const effectiveWebSearchEnabled = Boolean(effectiveConciergeEnabled && llmWebSearchEnabled && envWebSearchAvailable);
  const effectiveStyleEngineEnabled = Boolean(effectiveConciergeEnabled && llmStyleEngineEnabled && envStyleEngineAvailable);
  const effectiveBanditEnabled = Boolean(effectiveConciergeEnabled && llmBanditEnabled && envBanditAvailable);

  await appendAuditLog({
    actor,
    action: 'llm_config.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
        llmEnabled,
        llmConciergeEnabled,
        llmWebSearchEnabled,
        llmStyleEngineEnabled,
        llmBanditEnabled,
        envFlag: runtimeState.envFlag,
        systemFlag: runtimeState.systemFlag,
        envLlmFeatureFlag: envEnabled,
        envWebSearchAvailable,
        envStyleEngineAvailable,
        envBanditAvailable,
        effectiveEnabled,
        blockingReason: runtimeState.blockingReason,
        effectiveConciergeEnabled,
        effectiveWebSearchEnabled,
        effectiveStyleEngineEnabled,
        effectiveBanditEnabled,
        lawfulBasis: llmPolicy.lawfulBasis,
        consentVerified: llmPolicy.consentVerified,
        crossBorder: llmPolicy.crossBorder
    }
  });

  writeJson(res, STATUS_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled,
    envFlag: runtimeState.envFlag,
    systemFlag: runtimeState.systemFlag,
    llmPolicy,
    runtimeState,
    envLlmFeatureFlag: envEnabled,
    envWebSearchAvailable,
    envStyleEngineAvailable,
    envBanditAvailable,
    effectiveEnabled,
    blockingReason: runtimeState.blockingReason,
    effectiveConciergeEnabled,
    effectiveWebSearchEnabled,
    effectiveStyleEngineEnabled,
    effectiveBanditEnabled
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let llmEnabled;
  let llmConciergeEnabled;
  let llmWebSearchEnabled;
  let llmStyleEngineEnabled;
  let llmBanditEnabled;
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  const [currentLlmConciergeEnabled, currentLlmWebSearchEnabled, currentLlmStyleEngineEnabled, currentLlmBanditEnabled] = await Promise.all([
    systemFlagsRepo.getLlmConciergeEnabled(),
    systemFlagsRepo.getLlmWebSearchEnabled(),
    systemFlagsRepo.getLlmStyleEngineEnabled(),
    systemFlagsRepo.getLlmBanditEnabled()
  ]);
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
    llmConciergeEnabled = normalizeLlmConciergeEnabled(payload.llmConciergeEnabled, currentLlmConciergeEnabled);
    llmWebSearchEnabled = normalizeLlmWebSearchEnabled(payload.llmWebSearchEnabled, currentLlmWebSearchEnabled);
    llmStyleEngineEnabled = normalizeLlmStyleEngineEnabled(payload.llmStyleEngineEnabled, currentLlmStyleEngineEnabled);
    llmBanditEnabled = normalizeLlmBanditEnabled(payload.llmBanditEnabled, currentLlmBanditEnabled);
    llmPolicy = normalizeLlmPolicy(payload.llmPolicy, currentLlmPolicy);
  } catch (err) {
    writeJson(res, PLAN_ROUTE_KEY, 400, { ok: false, error: err.message || 'invalid', traceId }, {
      state: 'error',
      reason: normalizeReason(err && err.message, 'invalid_request')
    });
    return;
  }

  const planHash = computePlanHash(
    llmEnabled,
    llmPolicy,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled
  );
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'llm_config.plan',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      llmEnabled,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled,
      llmPolicy,
      lawfulBasis: llmPolicy.lawfulBasis,
      consentVerified: llmPolicy.consentVerified,
      crossBorder: llmPolicy.crossBorder,
      planHash
    }
  });

  writeJson(res, PLAN_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled,
    llmPolicy,
    planHash,
    confirmToken
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let llmEnabled;
  let llmConciergeEnabled;
  let llmWebSearchEnabled;
  let llmStyleEngineEnabled;
  let llmBanditEnabled;
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  const [currentLlmConciergeEnabled, currentLlmWebSearchEnabled, currentLlmStyleEngineEnabled, currentLlmBanditEnabled] = await Promise.all([
    systemFlagsRepo.getLlmConciergeEnabled(),
    systemFlagsRepo.getLlmWebSearchEnabled(),
    systemFlagsRepo.getLlmStyleEngineEnabled(),
    systemFlagsRepo.getLlmBanditEnabled()
  ]);
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
    llmConciergeEnabled = normalizeLlmConciergeEnabled(payload.llmConciergeEnabled, currentLlmConciergeEnabled);
    llmWebSearchEnabled = normalizeLlmWebSearchEnabled(payload.llmWebSearchEnabled, currentLlmWebSearchEnabled);
    llmStyleEngineEnabled = normalizeLlmStyleEngineEnabled(payload.llmStyleEngineEnabled, currentLlmStyleEngineEnabled);
    llmBanditEnabled = normalizeLlmBanditEnabled(payload.llmBanditEnabled, currentLlmBanditEnabled);
    llmPolicy = normalizeLlmPolicy(payload.llmPolicy, currentLlmPolicy);
  } catch (err) {
    writeJson(res, SET_ROUTE_KEY, 400, { ok: false, error: err.message || 'invalid', traceId }, {
      state: 'error',
      reason: normalizeReason(err && err.message, 'invalid_request')
    });
    return;
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    writeJson(res, SET_ROUTE_KEY, 400, { ok: false, error: 'planHash/confirmToken required', traceId }, {
      state: 'error',
      reason: 'planhash_confirmtoken_required'
    });
    return;
  }

  const expectedPlanHash = computePlanHash(
    llmEnabled,
    llmPolicy,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled
  );
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'llm_config.set',
      entityType: 'system_flags',
      entityId: 'phase0',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        expectedPlanHash,
        llmEnabled,
        llmConciergeEnabled,
        llmWebSearchEnabled,
        llmStyleEngineEnabled,
        llmBanditEnabled,
        llmPolicy,
        lawfulBasis: llmPolicy.lawfulBasis,
        consentVerified: llmPolicy.consentVerified,
        crossBorder: llmPolicy.crossBorder
      }
    });
    writeJson(res, SET_ROUTE_KEY, 409, { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }, {
      state: 'blocked',
      reason: 'plan_hash_mismatch'
    });
    return;
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'llm_config.set',
      entityType: 'system_flags',
      entityId: 'phase0',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch' }
    });
    writeJson(res, SET_ROUTE_KEY, 409, { ok: false, reason: 'confirm_token_mismatch', traceId }, {
      state: 'blocked',
      reason: 'confirm_token_mismatch'
    });
    return;
  }

  await systemFlagsRepo.setLlmEnabled(llmEnabled);
  await systemFlagsRepo.setLlmConciergeEnabled(llmConciergeEnabled);
  await systemFlagsRepo.setLlmWebSearchEnabled(llmWebSearchEnabled);
  await systemFlagsRepo.setLlmStyleEngineEnabled(llmStyleEngineEnabled);
  await systemFlagsRepo.setLlmBanditEnabled(llmBanditEnabled);
  await systemFlagsRepo.setLlmPolicy(llmPolicy);

  await appendAuditLog({
    actor,
    action: 'llm_config.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      llmEnabled,
      llmConciergeEnabled,
      llmWebSearchEnabled,
      llmStyleEngineEnabled,
      llmBanditEnabled,
      llmPolicy,
      lawfulBasis: llmPolicy.lawfulBasis,
      consentVerified: llmPolicy.consentVerified,
      crossBorder: llmPolicy.crossBorder
    }
  });

  writeJson(res, SET_ROUTE_KEY, 200, {
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled,
    llmConciergeEnabled,
    llmWebSearchEnabled,
    llmStyleEngineEnabled,
    llmBanditEnabled,
    llmPolicy
  }, {
    state: 'success',
    reason: 'completed'
  });
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
