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

function computePlanHash(llmEnabled, llmPolicy) {
  const text = `llmEnabled=${llmEnabled ? 'true' : 'false'};llmPolicy=${serializeLlmPolicy(llmPolicy)}`;
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
  const llmEnabled = await systemFlagsRepo.getLlmEnabled();
  const llmPolicy = await systemFlagsRepo.getLlmPolicy();
  const envEnabled = isLlmFeatureEnabled(process.env);
  const effectiveEnabled = Boolean(llmEnabled && envEnabled);

  await appendAuditLog({
    actor,
    action: 'llm_config.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      llmEnabled,
      envLlmFeatureFlag: envEnabled,
      effectiveEnabled,
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
    llmPolicy,
    envLlmFeatureFlag: envEnabled,
    effectiveEnabled
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
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
    llmPolicy = normalizeLlmPolicy(payload.llmPolicy, currentLlmPolicy);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(llmEnabled, llmPolicy);
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
  const currentLlmPolicy = await systemFlagsRepo.getLlmPolicy();
  let llmPolicy;
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
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

  const expectedPlanHash = computePlanHash(llmEnabled, llmPolicy);
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
    llmPolicy
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
