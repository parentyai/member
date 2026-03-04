'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

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
  const effectiveEnabled = Boolean(llmEnabled && envEnabled);
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
        envLlmFeatureFlag: envEnabled,
        envWebSearchAvailable,
        envStyleEngineAvailable,
        envBanditAvailable,
        effectiveEnabled,
        effectiveConciergeEnabled,
        effectiveWebSearchEnabled,
        effectiveStyleEngineEnabled,
        effectiveBanditEnabled,
        lawfulBasis: llmPolicy.lawfulBasis,
        consentVerified: llmPolicy.consentVerified,
        crossBorder: llmPolicy.crossBorder
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
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
    envLlmFeatureFlag: envEnabled,
    envWebSearchAvailable,
    envStyleEngineAvailable,
    envBanditAvailable,
    effectiveEnabled,
    effectiveConciergeEnabled,
    effectiveWebSearchEnabled,
    effectiveStyleEngineEnabled,
    effectiveBanditEnabled
  }));
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
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'invalid', traceId }));
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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
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
  }));
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
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'invalid', traceId }));
    return;
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId }));
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
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }));
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
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId }));
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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
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
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
