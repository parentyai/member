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

function computePlanHash(llmEnabled) {
  const text = `llmEnabled=${llmEnabled ? 'true' : 'false'}`;
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
  const envEnabled = isLlmFeatureEnabled(process.env);
  const effectiveEnabled = Boolean(llmEnabled && envEnabled);

  await appendAuditLog({
    actor,
    action: 'llm_config.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { llmEnabled, envLlmFeatureFlag: envEnabled, effectiveEnabled }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled,
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
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message || 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(llmEnabled);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'llm_config.plan',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { llmEnabled, planHash }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled,
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
  try {
    llmEnabled = normalizeLlmEnabled(payload.llmEnabled);
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

  const expectedPlanHash = computePlanHash(llmEnabled);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'llm_config.set',
      entityType: 'system_flags',
      entityId: 'phase0',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash }
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

  await appendAuditLog({
    actor,
    action: 'llm_config.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { ok: true, llmEnabled }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    serverTime: new Date().toISOString(),
    llmEnabled
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
