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

function computePlanHash(llmEnabled, llmPolicy, llmConciergeEnabled) {
  const text = `llmEnabled=${llmEnabled ? 'true' : 'false'};llmPolicy=${serializeLlmPolicy(llmPolicy)};llmConciergeEnabled=${llmConciergeEnabled ? 'true' : 'false'}`;
  return `llmcfg_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
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
  const [llmEnabled, llmConciergeEnabled] = await Promise.all([
    systemFlagsRepo.getLlmEnabled(),
    systemFlagsRepo.getLlmConciergeEnabled()
  ]);
  const llmPolicy = await systemFlagsRepo.getLlmPolicy();
  const envEnabled = isLlmFeatureEnabled(process.env);
  const effectiveEnabled = Boolean(llmEnabled && envEnabled);
  const effectiveConciergeEnabled = Boolean(llmEnabled && llmConciergeEnabled && envEnabled);

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
      envLlmFeatureFlag: envEnabled,
      effectiveEnabled,
      effectiveConciergeEnabled,
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
    llmPolicy,
    envLlmFeatureFlag: envEnabled,
    effectiveEnabled,
    effectiveConciergeEnabled
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
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  const currentLlmConciergeEnabled = await systemFlagsRepo.getLlmConciergeEnabled();
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
    llmConciergeEnabled = normalizeLlmConciergeEnabled(payload.llmConciergeEnabled, currentLlmConciergeEnabled);
    llmPolicy = normalizeLlmPolicy(payload.llmPolicy, currentLlmPolicy);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(llmEnabled, llmPolicy, llmConciergeEnabled);
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
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  const currentLlmConciergeEnabled = await systemFlagsRepo.getLlmConciergeEnabled();
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
    llmConciergeEnabled = normalizeLlmConciergeEnabled(payload.llmConciergeEnabled, currentLlmConciergeEnabled);
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

  const expectedPlanHash = computePlanHash(llmEnabled, llmPolicy, llmConciergeEnabled);
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
    llmPolicy
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
