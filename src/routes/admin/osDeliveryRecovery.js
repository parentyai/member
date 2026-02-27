'use strict';

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  normalizeDeliveryId,
  normalizeReason,
  computePlanHash,
  confirmTokenData,
  getRecoveryStatus,
  planRecovery,
  executeRecovery
} = require('../../usecases/deliveries/deliveryRecoveryAdmin');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
    writeJson(res, 400, { ok: false, error: 'deliveryId required', traceId });
    return;
  }
  const result = await getRecoveryStatus({
    deliveryId,
    actor,
    traceId,
    requestId
  });
  writeJson(res, result.statusCode, result.body);
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, res);
  if (!bodyPayload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(bodyPayload.deliveryId);
    sealedReason = normalizeReason(bodyPayload.sealedReason);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId });
    return;
  }

  const planned = await planRecovery({
    deliveryId,
    sealedReason,
    actor,
    traceId,
    requestId
  });
  if (planned.statusCode !== 200) {
    writeJson(res, planned.statusCode, planned.body);
    return;
  }

  const confirmToken = createConfirmToken(confirmTokenData(planned.body.planHash, deliveryId), { now: new Date() });
  writeJson(res, 200, Object.assign({}, planned.body, { confirmToken }));
}

async function handleExecute(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, res);
  if (!bodyPayload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(bodyPayload.deliveryId);
    sealedReason = normalizeReason(bodyPayload.sealedReason);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId });
    return;
  }

  const planHash = typeof bodyPayload.planHash === 'string' ? bodyPayload.planHash : null;
  const confirmToken = typeof bodyPayload.confirmToken === 'string' ? bodyPayload.confirmToken : null;
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId });
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
    writeJson(res, 409, { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId });
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
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId });
    return;
  }

  const executed = await executeRecovery({
    deliveryId,
    sealedReason,
    planHash,
    actor,
    traceId,
    requestId
  });
  writeJson(res, executed.statusCode, executed.body);
}

module.exports = {
  handleStatus,
  handlePlan,
  handleExecute
};
