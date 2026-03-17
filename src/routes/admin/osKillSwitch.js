'use strict';

const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getKillSwitch, setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');
const { resolveRequestId, resolveTraceId } = require('./osContext');

const ROUTE_KEY = 'admin_os_kill_switch';

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

function computePlanHash(isOn) {
  return isOn ? 'kill_switch_on' : 'kill_switch_off';
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'kill_switch',
    templateVersion: '',
    segmentKey: 'phase0'
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const killSwitch = await getKillSwitch();
  await appendAuditLog({
    actor,
    action: 'kill_switch.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { killSwitch }
  });
  writeJson(res, 200, { ok: true, serverTime: new Date().toISOString(), traceId, killSwitch }, {
    state: 'success',
    reason: 'status_viewed'
  });
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, req, res);
  if (!payload) return;
  const isOn = Boolean(payload.isOn);
  const planHash = computePlanHash(isOn);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });
  await appendAuditLog({
    actor,
    action: 'kill_switch.plan',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { isOn, planHash }
  });
  writeJson(res, 200, {
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    isOn,
    planHash,
    confirmToken
  }, {
    state: 'success',
    reason: 'planned'
  });
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, req, res);
  if (!payload) return;
  const isOn = Boolean(payload.isOn);
  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    writeJson(res, 400, { ok: false, error: 'planHash/confirmToken required', traceId }, {
      state: 'error',
      reason: 'confirm_token_required',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const expectedPlanHash = computePlanHash(isOn);
  if (planHash !== expectedPlanHash) {
    writeJson(res, 409, { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }, {
      state: 'blocked',
      reason: 'plan_hash_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'kill_switch.set',
      entityType: 'system_flags',
      entityId: 'phase0',
      traceId,
      requestId,
      payloadSummary: { isOn, ok: false, reason: 'confirm_token_mismatch' }
    });
    writeJson(res, 409, { ok: false, reason: 'confirm_token_mismatch', traceId }, {
      state: 'blocked',
      reason: 'confirm_token_mismatch',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const result = await setKillSwitch(isOn);
  await appendAuditLog({
    actor,
    action: 'kill_switch.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { isOn, ok: true }
  });
  writeJson(res, 200, {
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    killSwitch: result.killSwitch
  }, {
    state: 'success',
    reason: 'kill_switch_updated'
  });
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
