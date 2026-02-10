'use strict';

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getKillSwitch, setKillSwitch } = require('../../usecases/killSwitch/setKillSwitch');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, serverTime: new Date().toISOString(), traceId, killSwitch }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    isOn,
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
  const isOn = Boolean(payload.isOn);
  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId }));
    return;
  }
  const expectedPlanHash = computePlanHash(isOn);
  if (planHash !== expectedPlanHash) {
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }));
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
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId }));
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
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, serverTime: new Date().toISOString(), traceId, killSwitch: result.killSwitch }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};

