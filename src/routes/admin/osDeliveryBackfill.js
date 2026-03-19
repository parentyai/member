'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  normalizeLimit,
  confirmTokenData,
  getBackfillStatus,
  planBackfill,
  executeBackfill
} = require('../../usecases/deliveries/deliveryBackfillAdmin');
const { resolveRequestId, resolveTraceId } = require('./osContext');

const MAX_LIMIT = 1000;
const ROUTE_KEY = 'admin_os_delivery_backfill';

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

function resolveExecuteOutcome(executed) {
  const body = executed && executed.body && typeof executed.body === 'object' ? executed.body : {};
  const result = body.result && typeof body.result === 'object' ? body.result : {};
  const summaryAfter = body.summaryAfter && typeof body.summaryAfter === 'object' ? body.summaryAfter : {};
  if (Number(summaryAfter.fixableCount) > 0) {
    return { state: 'partial', reason: 'completed_with_more_remaining' };
  }
  if (Number(result.skippedCount) > 0) {
    return { state: 'partial', reason: 'completed_with_skips' };
  }
  return { state: 'success', reason: 'completed' };
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
    writeJson(res, 400, { ok: false, error: `limit must be integer 1-${MAX_LIMIT}`, traceId }, {
      state: 'error',
      reason: 'invalid_limit',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const payload = await getBackfillStatus({
    limit,
    actor,
    traceId,
    requestId
  });
  writeJson(res, 200, payload, {
    state: 'success',
    reason: 'status_viewed'
  });
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const bodyPayload = parseJson(body, req, res);
  if (!bodyPayload) return;

  let limit;
  try {
    limit = normalizeLimit(bodyPayload.limit);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId }, {
      state: 'error',
      reason: 'invalid_limit',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const planned = await planBackfill({
    limit,
    actor,
    traceId,
    requestId
  });
  const confirmToken = createConfirmToken(confirmTokenData(planned.planHash, limit), { now: new Date() });
  writeJson(res, 200, Object.assign({}, planned, { confirmToken }), {
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

  let limit;
  try {
    limit = normalizeLimit(bodyPayload.limit);
  } catch (err) {
    writeJson(res, 400, { ok: false, error: err && err.message ? err.message : 'invalid', traceId }, {
      state: 'error',
      reason: 'invalid_limit',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
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
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId }, {
      state: 'blocked',
      reason: 'confirm_token_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const executed = await executeBackfill({
    limit,
    planHash,
    actor,
    traceId,
    requestId
  });
  if (executed.statusCode === 409 && executed.body && executed.body.reason === 'plan_hash_mismatch') {
    writeJson(res, executed.statusCode, executed.body, {
      state: 'blocked',
      reason: 'plan_hash_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  writeJson(res, executed.statusCode, executed.body, resolveExecuteOutcome(executed));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleExecute
};
