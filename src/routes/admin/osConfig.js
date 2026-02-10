'use strict';

const crypto = require('crypto');

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

function normalizeServicePhase(value) {
  if (value === null) return null;
  if (value === undefined) throw new Error('servicePhase required');
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 4) throw new Error('invalid servicePhase');
  return num;
}

function normalizeNotificationPreset(value) {
  if (value === null) return null;
  if (value === undefined) throw new Error('notificationPreset required');
  if (typeof value !== 'string') throw new Error('invalid notificationPreset');
  const upper = value.trim().toUpperCase();
  if (upper !== 'A' && upper !== 'B' && upper !== 'C') throw new Error('invalid notificationPreset');
  return upper;
}

function computePlanHash(servicePhase, notificationPreset) {
  const text = `servicePhase=${servicePhase === null ? 'null' : String(servicePhase)};notificationPreset=${notificationPreset === null ? 'null' : String(notificationPreset)}`;
  return `cfg_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'system_config',
    templateVersion: '',
    segmentKey: 'phase0'
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();

  const [servicePhase, notificationPreset] = await Promise.all([
    systemFlagsRepo.getServicePhase(),
    systemFlagsRepo.getNotificationPreset()
  ]);

  await appendAuditLog({
    actor,
    action: 'system_config.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { servicePhase, notificationPreset }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, serverTime, traceId, requestId, servicePhase, notificationPreset }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let servicePhase;
  let notificationPreset;
  try {
    servicePhase = normalizeServicePhase(payload.servicePhase);
    notificationPreset = normalizeNotificationPreset(payload.notificationPreset);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(servicePhase, notificationPreset);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'system_config.plan',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { servicePhase, notificationPreset, planHash }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    servicePhase,
    notificationPreset,
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

  let servicePhase;
  let notificationPreset;
  try {
    servicePhase = normalizeServicePhase(payload.servicePhase);
    notificationPreset = normalizeNotificationPreset(payload.notificationPreset);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const expectedPlanHash = computePlanHash(servicePhase, notificationPreset);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'system_config.set',
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
      action: 'system_config.set',
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

  await Promise.all([
    systemFlagsRepo.setServicePhase(servicePhase),
    systemFlagsRepo.setNotificationPreset(notificationPreset)
  ]);

  await appendAuditLog({
    actor,
    action: 'system_config.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { ok: true, servicePhase, notificationPreset }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, serverTime: new Date().toISOString(), traceId, requestId, servicePhase, notificationPreset }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};

