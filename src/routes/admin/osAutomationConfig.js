'use strict';

const crypto = require('crypto');

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const MODES = new Set(['OFF', 'DRY_RUN_ONLY', 'EXECUTE']);

function normalizeMode(value) {
  if (typeof value !== 'string') throw new Error('mode required');
  const mode = value.trim().toUpperCase();
  if (!MODES.has(mode)) throw new Error('invalid mode');
  return mode;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function hasOwn(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key);
}

function pickExistingArray(record, key, fallbackKey) {
  if (!record || typeof record !== 'object') return [];
  if (hasOwn(record, key)) return normalizeStringArray(record[key]);
  if (fallbackKey && hasOwn(record, fallbackKey)) return normalizeStringArray(record[fallbackKey]);
  return [];
}

function buildDesiredConfig(payload, latest) {
  const body = payload || {};
  const mode = normalizeMode(body.mode);
  const allowScenarios = hasOwn(body, 'allowScenarios')
    ? normalizeStringArray(body.allowScenarios)
    : pickExistingArray(latest, 'allowScenarios');
  const allowSteps = hasOwn(body, 'allowSteps')
    ? normalizeStringArray(body.allowSteps)
    : pickExistingArray(latest, 'allowSteps');
  const allowNextActions = hasOwn(body, 'allowNextActions')
    ? normalizeStringArray(body.allowNextActions)
    : pickExistingArray(latest, 'allowNextActions', 'allowedActions');

  return {
    mode,
    enabled: mode !== 'OFF',
    allowScenarios,
    allowSteps,
    allowNextActions
  };
}

function computePlanHash(config) {
  const text = JSON.stringify({
    mode: config.mode,
    allowScenarios: config.allowScenarios || [],
    allowSteps: config.allowSteps || [],
    allowNextActions: config.allowNextActions || []
  });
  return `auto_cfg_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'automation_config',
    templateVersion: '',
    segmentKey: 'phase48'
  };
}

function sanitizeLatestRecord(record) {
  const latest = record && typeof record === 'object' ? record : {};
  const next = Object.assign({}, latest);
  delete next.id;
  delete next.createdAt;
  delete next.updatedAt;
  return next;
}

function buildPersistRecord(latest, desired, actor) {
  return Object.assign(
    {},
    sanitizeLatestRecord(latest),
    desired,
    {
      allowScenarios: desired.allowScenarios,
      allowSteps: desired.allowSteps,
      allowNextActions: desired.allowNextActions,
      updatedBy: actor
    }
  );
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const latest = await automationConfigRepo.getLatestAutomationConfig();
  const config = automationConfigRepo.normalizePhase48Config(latest);

  await appendAuditLog({
    actor,
    action: 'automation_config.status.view',
    entityType: 'automation_config',
    entityId: 'latest',
    traceId,
    requestId,
    payloadSummary: { mode: config.mode, enabled: config.enabled }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    config
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let desired;
  try {
    const latest = await automationConfigRepo.getLatestAutomationConfig();
    desired = buildDesiredConfig(payload, latest);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(desired);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'automation_config.plan',
    entityType: 'automation_config',
    entityId: 'latest',
    traceId,
    requestId,
    payloadSummary: Object.assign({ planHash }, desired)
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    mode: desired.mode,
    allowScenarios: desired.allowScenarios,
    allowSteps: desired.allowSteps,
    allowNextActions: desired.allowNextActions,
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

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId }));
    return;
  }

  let latest;
  let desired;
  try {
    latest = await automationConfigRepo.getLatestAutomationConfig();
    desired = buildDesiredConfig(payload, latest);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const expectedPlanHash = computePlanHash(desired);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'automation_config.set',
      entityType: 'automation_config',
      entityId: 'latest',
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
      action: 'automation_config.set',
      entityType: 'automation_config',
      entityId: 'latest',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch' }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId }));
    return;
  }

  const persisted = buildPersistRecord(latest, desired, actor);
  const writeResult = await automationConfigRepo.appendAutomationConfig(persisted);

  await appendAuditLog({
    actor,
    action: 'automation_config.set',
    entityType: 'automation_config',
    entityId: writeResult.id,
    traceId,
    requestId,
    payloadSummary: Object.assign({ ok: true }, desired)
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    id: writeResult.id,
    config: automationConfigRepo.normalizePhase48Config(persisted)
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
