'use strict';

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  normalizeLimit,
  confirmTokenData,
  getBackfillStatus,
  planBackfill,
  executeBackfill
} = require('../../usecases/deliveries/deliveryBackfillAdmin');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const MAX_LIMIT = 1000;

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function resolveLimitFromQuery(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return normalizeLimit(url.searchParams.get('limit'));
  } catch (_err) {
    return null;
  }
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = resolveLimitFromQuery(req);
  if (!limit) {
    writeJson(res, 400, { ok: false, error: `limit must be integer 1-${MAX_LIMIT}`, traceId });
    return;
  }
  const payload = await getBackfillStatus({
    limit,
    actor,
    traceId,
    requestId
  });
  writeJson(res, 200, payload);
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, res);
  if (!bodyPayload) return;

  let limit;
  try {
    limit = normalizeLimit(bodyPayload.limit);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId });
    return;
  }

  const planned = await planBackfill({
    limit,
    actor,
    traceId,
    requestId
  });
  const confirmToken = createConfirmToken(confirmTokenData(planned.planHash, limit), { now: new Date() });
  writeJson(res, 200, Object.assign({}, planned, { confirmToken }));
}

async function handleExecute(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, res);
  if (!bodyPayload) return;

  const planHash = typeof bodyPayload.planHash === 'string' ? bodyPayload.planHash : null;
  const confirmToken = typeof bodyPayload.confirmToken === 'string' ? bodyPayload.confirmToken : null;
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId });
    return;
  }

  let limit;
  try {
    limit = normalizeLimit(bodyPayload.limit);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId });
    return;
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, limit), { now: new Date() });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'delivery_backfill.execute',
      entityType: 'notification_deliveries',
      entityId: 'deliveredAt',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', limit }
    });
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId });
    return;
  }

  const executed = await executeBackfill({
    limit,
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
