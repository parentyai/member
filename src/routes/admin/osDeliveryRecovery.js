'use strict';

const crypto = require('crypto');

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

function normalizeDeliveryId(value) {
  if (typeof value !== 'string') throw new Error('deliveryId required');
  const deliveryId = value.trim();
  if (!deliveryId) throw new Error('deliveryId required');
  return deliveryId;
}

function normalizeReason(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('invalid sealedReason');
  const reason = value.trim();
  if (!reason) return null;
  if (reason.length > 200) throw new Error('sealedReason too long');
  return reason;
}

function computePlanHash(deliveryId, sealedReason) {
  const text = `deliveryId=${deliveryId};action=seal;sealedReason=${sealedReason || ''}`;
  return `seal_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash, deliveryId) {
  return {
    planHash,
    templateKey: 'delivery_recovery',
    templateVersion: '',
    segmentKey: deliveryId
  };
}

function deliverySummary(delivery) {
  if (!delivery) return null;
  const state = delivery.state || null;
  const delivered = delivery.delivered === true;
  const sealed = delivery.sealed === true;
  let recommendedAction = 'INSPECT';
  const allowedActions = [];
  if (delivered) {
    recommendedAction = 'NO_ACTION';
  } else if (sealed) {
    recommendedAction = 'NO_ACTION';
  } else if (state === 'failed') {
    recommendedAction = 'RETRY_OR_SEAL';
    allowedActions.push('RETRY');
    allowedActions.push('SEAL');
  } else if (state === 'reserved') {
    recommendedAction = 'SEAL';
    allowedActions.push('SEAL');
  } else {
    recommendedAction = 'SEAL';
    allowedActions.push('SEAL');
  }
  return {
    deliveryId: delivery.id || null,
    state,
    delivered,
    sealed,
    reservedAt: delivery.reservedAt || null,
    sentAt: delivery.sentAt || null,
    lastError: delivery.lastError || null,
    recovery: {
      retryPossible: state === 'failed' && !delivered && !sealed,
      canSeal: !delivered,
      recommendedAction,
      allowedActions
    }
  };
}

function resolveDeliveryIdFromQuery(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return normalizeDeliveryId(url.searchParams.get('deliveryId'));
  } catch (_err) {
    return null;
  }
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const deliveryId = resolveDeliveryIdFromQuery(req);
  if (!deliveryId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'deliveryId required', traceId }));
    return;
  }

  const delivery = await deliveriesRepo.getDelivery(deliveryId);
  if (!delivery) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.status.view',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    });
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'not_found', deliveryId, traceId }));
    return;
  }

  const summary = deliverySummary(delivery);
  await appendAuditLog({
    actor,
    action: 'delivery_recovery.status.view',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId,
    requestId,
    payloadSummary: Object.assign({ ok: true }, summary)
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    delivery: summary
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(payload.deliveryId);
    sealedReason = normalizeReason(payload.sealedReason);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const delivery = await deliveriesRepo.getDelivery(deliveryId);
  if (!delivery) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.plan',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    });
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'not_found', deliveryId, traceId }));
    return;
  }
  if (delivery.delivered === true) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.plan',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'already_delivered', deliveryId }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'already_delivered', deliveryId, traceId }));
    return;
  }

  const planHash = computePlanHash(deliveryId, sealedReason);
  const confirmToken = createConfirmToken(confirmTokenData(planHash, deliveryId), { now: new Date() });
  const summary = deliverySummary(delivery);

  await appendAuditLog({
    actor,
    action: 'delivery_recovery.plan',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      planHash,
      deliveryId,
      sealedReason,
      state: summary.state,
      sealed: summary.sealed
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    delivery: summary,
    planHash,
    confirmToken,
    sealedReason
  }));
}

async function handleExecute(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(payload.deliveryId);
    sealedReason = normalizeReason(payload.sealedReason);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId }));
    return;
  }

  const expectedPlanHash = computePlanHash(deliveryId, sealedReason);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, deliveryId }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }));
    return;
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, deliveryId), { now: new Date() });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', deliveryId }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId }));
    return;
  }

  const delivery = await deliveriesRepo.getDelivery(deliveryId);
  if (!delivery) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    });
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'not_found', deliveryId, traceId }));
    return;
  }
  if (delivery.delivered === true) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'already_delivered', deliveryId }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'already_delivered', deliveryId, traceId }));
    return;
  }
  if (delivery.sealed === true) {
    await appendAuditLog({
      actor,
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId,
      requestId,
      payloadSummary: { ok: true, alreadySealed: true, deliveryId }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId, deliveryId, alreadySealed: true }));
    return;
  }

  await deliveriesRepo.sealDeliveryWithId(deliveryId, {
    sealedBy: actor,
    sealedReason
  });
  const updated = await deliveriesRepo.getDelivery(deliveryId);
  const summary = deliverySummary(updated);

  await appendAuditLog({
    actor,
    action: 'delivery_recovery.execute',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId,
    requestId,
    payloadSummary: { ok: true, deliveryId, sealedReason, sealed: true }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    delivery: summary
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleExecute
};
