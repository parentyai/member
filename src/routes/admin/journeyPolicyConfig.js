'use strict';

const crypto = require('crypto');

const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const { parseJson, requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function serializePolicy(policy) {
  const payload = policy && typeof policy === 'object' ? policy : {};
  return JSON.stringify({
    enabled: payload.enabled === true,
    reminder_offsets_days: Array.isArray(payload.reminder_offsets_days) ? payload.reminder_offsets_days : [7, 3, 1],
    reminder_max_per_run: payload.reminder_max_per_run,
    paid_only_reminders: payload.paid_only_reminders === true,
    rich_menu_enabled: payload.rich_menu_enabled === true,
    schedule_required_for_reminders: payload.schedule_required_for_reminders !== false,
    rich_menu_map: payload.rich_menu_map && typeof payload.rich_menu_map === 'object' ? payload.rich_menu_map : {},
    auto_upgrade_message_enabled: payload.auto_upgrade_message_enabled !== false,
    auto_downgrade_message_enabled: payload.auto_downgrade_message_enabled !== false
  });
}

function computePlanHash(policy) {
  const text = `journeyPolicy=${serializePolicy(policy)}`;
  return `journeypolicy_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash) {
  return {
    planHash,
    templateKey: 'journey_policy',
    templateVersion: '',
    segmentKey: 'opsConfig'
  };
}

function resolveFeatureFlags() {
  const parseFlag = (name, defaultValue) => {
    const raw = process.env[name];
    if (typeof raw !== 'string') return defaultValue;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
    if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
    return defaultValue;
  };
  return {
    reminderJobEnabled: parseFlag('ENABLE_JOURNEY_REMINDER_JOB', true),
    richMenuEnabled: parseFlag('ENABLE_RICH_MENU_DYNAMIC', true),
    paidFaqQualityEnabled: parseFlag('ENABLE_PAID_FAQ_QUALITY_V2', true)
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const journeyPolicy = await journeyPolicyRepo.getJourneyPolicy();
  const flags = resolveFeatureFlags();
  const effectiveEnabled = Boolean(journeyPolicy.enabled && flags.reminderJobEnabled);

  await appendAuditLog({
    actor,
    action: 'journey_policy.status.view',
    entityType: 'opsConfig',
    entityId: 'journeyPolicy',
    traceId,
    requestId,
    payloadSummary: {
      effectiveEnabled,
      flags,
      journeyPolicy
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyPolicy,
    flags,
    effectiveEnabled,
    serverTime: new Date().toISOString()
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const base = await journeyPolicyRepo.getJourneyPolicy();
  const candidate = payload.policy === undefined
    ? base
    : Object.assign({}, base, payload.policy && typeof payload.policy === 'object' ? payload.policy : {});
  const normalized = journeyPolicyRepo.normalizeJourneyPolicy(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid journeyPolicy', traceId, requestId }));
    return;
  }

  const planHash = computePlanHash(normalized);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });

  await appendAuditLog({
    actor,
    action: 'journey_policy.plan',
    entityType: 'opsConfig',
    entityId: 'journeyPolicy',
    traceId,
    requestId,
    payloadSummary: {
      planHash,
      journeyPolicy: normalized
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyPolicy: normalized,
    planHash,
    confirmToken,
    serverTime: new Date().toISOString()
  }));
}

async function handleSet(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const base = await journeyPolicyRepo.getJourneyPolicy();
  const candidate = payload.policy === undefined
    ? base
    : Object.assign({}, base, payload.policy && typeof payload.policy === 'object' ? payload.policy : {});
  const normalized = journeyPolicyRepo.normalizeJourneyPolicy(candidate);
  if (!normalized) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid journeyPolicy', traceId, requestId }));
    return;
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash.trim() : '';
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken.trim() : '';
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId, requestId }));
    return;
  }

  const expectedPlanHash = computePlanHash(normalized);
  if (expectedPlanHash !== planHash) {
    await appendAuditLog({
      actor,
      action: 'journey_policy.set',
      entityType: 'opsConfig',
      entityId: 'journeyPolicy',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'plan_hash_mismatch',
        expectedPlanHash,
        planHash
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId, requestId }));
    return;
  }

  const tokenValid = verifyConfirmToken(confirmToken, confirmTokenData(planHash), { now: new Date() });
  if (!tokenValid) {
    await appendAuditLog({
      actor,
      action: 'journey_policy.set',
      entityType: 'opsConfig',
      entityId: 'journeyPolicy',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        reason: 'confirm_token_mismatch'
      }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId, requestId }));
    return;
  }

  const saved = await journeyPolicyRepo.setJourneyPolicy(normalized, actor);
  await appendAuditLog({
    actor,
    action: 'journey_policy.set',
    entityType: 'opsConfig',
    entityId: 'journeyPolicy',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      journeyPolicy: saved
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    journeyPolicy: saved,
    serverTime: new Date().toISOString()
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
