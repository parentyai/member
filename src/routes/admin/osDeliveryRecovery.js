'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
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
const { resolveRequestId, resolveTraceId } = require('./osContext');

const ROUTE_KEY = 'admin_os_delivery_recovery';

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'admin_route',
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  }, outcomeOptions || {}));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function requireActor(req, res) {
  const actor = req && req.headers && typeof req.headers['x-actor'] === 'string'
    ? req.headers['x-actor'].trim()
    : '';
  if (actor) return actor;
  writeJson(res, 400, { ok: false, error: 'x-actor required', traceId: resolveTraceId(req) }, {
    state: 'error',
    reason: 'actor_required',
    guard: { routeKey: ROUTE_KEY, decision: 'block' }
  });
  return null;
}

function parseJson(body, req, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (_err) {
    writeJson(res, 400, { ok: false, error: 'invalid json', traceId: resolveTraceId(req) }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return null;
  }
}

function resolveStatusOutcome(result) {
  if (result && result.statusCode === 404) {
    return {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    };
  }
  return { state: 'success', reason: 'status_viewed' };
}

function resolvePlanOrExecuteOutcome(result, successReason) {
  const body = result && result.body && typeof result.body === 'object' ? result.body : {};
  if (result && result.statusCode === 404 && body.reason === 'not_found') {
    return {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    };
  }
  if (result && result.statusCode === 409 && body.reason === 'already_delivered') {
    return {
      state: 'blocked',
      reason: 'already_delivered',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    };
  }
  if (result && result.statusCode === 200 && body.alreadySealed === true) {
    return { state: 'success', reason: 'already_sealed' };
  }
  return { state: 'success', reason: successReason };
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
  writeJson(res, result.statusCode, result.body, resolveStatusOutcome(result));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, req, res);
  if (!bodyPayload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(bodyPayload.deliveryId);
    sealedReason = normalizeReason(bodyPayload.sealedReason);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId }, {
      state: 'error',
      reason: 'invalid_request',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
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
    writeJson(res, planned.statusCode, planned.body, resolvePlanOrExecuteOutcome(planned, 'planned'));
    return;
  }

  const confirmToken = createConfirmToken(confirmTokenData(planned.body.planHash, deliveryId), { now: new Date() });
  writeJson(res, 200, Object.assign({}, planned.body, { confirmToken }), {
    state: 'success',
    reason: 'planned'
  });
}

async function handleExecute(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, req, res);
  if (!bodyPayload) return;

  let deliveryId;
  let sealedReason;
  try {
    deliveryId = normalizeDeliveryId(bodyPayload.deliveryId);
    sealedReason = normalizeReason(bodyPayload.sealedReason);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId }, {
      state: 'error',
      reason: 'invalid_request',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const planHash = typeof bodyPayload.planHash === 'string' ? bodyPayload.planHash : null;
  const confirmToken = typeof bodyPayload.confirmToken === 'string' ? bodyPayload.confirmToken : null;
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId }, {
      state: 'error',
      reason: 'confirm_token_required',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
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
    writeJson(res, 409, { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }, {
      state: 'blocked',
      reason: 'plan_hash_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
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
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId }, {
      state: 'blocked',
      reason: 'confirm_token_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
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
  writeJson(res, executed.statusCode, executed.body, resolvePlanOrExecuteOutcome(executed, 'completed'));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleExecute
};
