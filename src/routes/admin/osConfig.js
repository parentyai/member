'use strict';

const crypto = require('crypto');

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');
const { NOTIFICATION_CATEGORIES } = require('../../domain/notificationCategory');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { checkNotificationCap } = require('../../usecases/notifications/checkNotificationCap');
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

function normalizeDeliveryCountLegacyFallback(value, fallback) {
  if (value === undefined) return fallback !== false;
  if (value === null) return true;
  if (typeof value !== 'boolean') throw new Error('invalid deliveryCountLegacyFallback');
  return value;
}

function normalizeCaps(payload, fallback) {
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'notificationCaps')) {
    return normalizeNotificationCaps(payload.notificationCaps);
  }
  return normalizeNotificationCaps(fallback);
}

function computePlanHash(servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback) {
  const caps = normalizeNotificationCaps(notificationCaps);
  const quiet = caps.quietHours
    ? `${caps.quietHours.startHourUtc}-${caps.quietHours.endHourUtc}`
    : 'null';
  const text = [
    `servicePhase=${servicePhase === null ? 'null' : String(servicePhase)}`,
    `notificationPreset=${notificationPreset === null ? 'null' : String(notificationPreset)}`,
    `perUserWeeklyCap=${caps.perUserWeeklyCap === null ? 'null' : String(caps.perUserWeeklyCap)}`,
    `perUserDailyCap=${caps.perUserDailyCap === null ? 'null' : String(caps.perUserDailyCap)}`,
    `perCategoryWeeklyCap=${caps.perCategoryWeeklyCap === null ? 'null' : String(caps.perCategoryWeeklyCap)}`,
    `quietHours=${quiet}`,
    `deliveryCountLegacyFallback=${deliveryCountLegacyFallback === false ? 'false' : 'true'}`
  ].join(';');
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

async function buildImpactPreview(notificationCaps) {
  const caps = normalizeNotificationCaps(notificationCaps);
  const allNull = caps.perUserWeeklyCap === null
    && caps.perUserDailyCap === null
    && caps.perCategoryWeeklyCap === null
    && caps.quietHours === null;
  if (allNull) {
    return {
      sampledUsers: 0,
      sampledEvaluations: 0,
      estimatedBlockedUsers: 0,
      simulatedCategories: [],
      blockedByCapType: {},
      blockedByCategory: {},
      blockedByReason: {},
      notes: ['caps_disabled']
    };
  }

  const now = new Date();
  const sampleLimit = 100;
  const categories = caps.perCategoryWeeklyCap !== null ? NOTIFICATION_CATEGORIES : [null];
  let users;
  try {
    users = await usersRepo.listUsers({ limit: sampleLimit });
  } catch (_err) {
    return {
      sampledUsers: 0,
      sampledEvaluations: 0,
      estimatedBlockedUsers: null,
      simulatedCategories: [],
      blockedByCapType: {},
      blockedByCategory: {},
      blockedByReason: {},
      notes: ['preview_unavailable']
    };
  }

  const blockedByCapType = {};
  const blockedByCategory = {};
  const blockedByReason = {};
  const blockedUsers = new Set();
  let sampledEvaluations = 0;
  let estimatedBlockedUsers = 0;
  for (const user of users) {
    const lineUserId = user && typeof user.id === 'string' ? user.id : null;
    if (!lineUserId) continue;
    for (const category of categories) {
      const result = await checkNotificationCap({
        lineUserId,
        now,
        notificationCaps: caps,
        notificationCategory: category
      });
      sampledEvaluations += 1;
      if (!result.allowed) {
        blockedUsers.add(lineUserId);
        const typeKey = result.capType || 'UNKNOWN';
        const reasonKey = result.reason || 'unknown';
        blockedByCapType[typeKey] = (blockedByCapType[typeKey] || 0) + 1;
        blockedByReason[reasonKey] = (blockedByReason[reasonKey] || 0) + 1;
        if (category) {
          blockedByCategory[category] = (blockedByCategory[category] || 0) + 1;
        } else {
          blockedByCategory.UNCATEGORIZED = (blockedByCategory.UNCATEGORIZED || 0) + 1;
        }
      }
    }
  }
  estimatedBlockedUsers = blockedUsers.size;

  const notes = [];
  if (caps.perCategoryWeeklyCap !== null) notes.push('perCategoryWeeklyCap preview simulates all categories');
  if (caps.quietHours) notes.push('quietHours evaluated in UTC');

  return {
    sampledUsers: users.length,
    sampledEvaluations,
    estimatedBlockedUsers,
    simulatedCategories: categories.filter((v) => typeof v === 'string'),
    blockedByCapType,
    blockedByCategory,
    blockedByReason,
    notes
  };
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const serverTime = new Date().toISOString();

  const [servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback] = await Promise.all([
    systemFlagsRepo.getServicePhase(),
    systemFlagsRepo.getNotificationPreset(),
    systemFlagsRepo.getNotificationCaps(),
    systemFlagsRepo.getDeliveryCountLegacyFallback()
  ]);

  await appendAuditLog({
    actor,
    action: 'system_config.status.view',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime,
    traceId,
    requestId,
    servicePhase,
    notificationPreset,
    notificationCaps,
    deliveryCountLegacyFallback
  }));
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
  let notificationCaps;
  let deliveryCountLegacyFallback;
  try {
    servicePhase = normalizeServicePhase(payload.servicePhase);
    notificationPreset = normalizeNotificationPreset(payload.notificationPreset);
    const [currentCaps, currentDeliveryCountLegacyFallback] = await Promise.all([
      systemFlagsRepo.getNotificationCaps(),
      systemFlagsRepo.getDeliveryCountLegacyFallback()
    ]);
    notificationCaps = normalizeCaps(payload, currentCaps);
    deliveryCountLegacyFallback = normalizeDeliveryCountLegacyFallback(
      payload.deliveryCountLegacyFallback,
      currentDeliveryCountLegacyFallback
    );
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const planHash = computePlanHash(servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback);
  const confirmToken = createConfirmToken(confirmTokenData(planHash), { now: new Date() });
  const impactPreview = await buildImpactPreview(notificationCaps);

  await appendAuditLog({
    actor,
    action: 'system_config.plan',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: {
      servicePhase,
      notificationPreset,
      notificationCaps,
      deliveryCountLegacyFallback,
      planHash,
      impactPreview: {
        sampledUsers: impactPreview.sampledUsers,
        sampledEvaluations: impactPreview.sampledEvaluations,
        estimatedBlockedUsers: impactPreview.estimatedBlockedUsers,
        blockedByCapType: impactPreview.blockedByCapType,
        blockedByCategory: impactPreview.blockedByCategory
      }
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    servicePhase,
    notificationPreset,
    notificationCaps,
    deliveryCountLegacyFallback,
    planHash,
    confirmToken,
    impactPreview
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
  let notificationCaps;
  let deliveryCountLegacyFallback;
  try {
    servicePhase = normalizeServicePhase(payload.servicePhase);
    notificationPreset = normalizeNotificationPreset(payload.notificationPreset);
    const [currentCaps, currentDeliveryCountLegacyFallback] = await Promise.all([
      systemFlagsRepo.getNotificationCaps(),
      systemFlagsRepo.getDeliveryCountLegacyFallback()
    ]);
    notificationCaps = normalizeCaps(payload, currentCaps);
    deliveryCountLegacyFallback = normalizeDeliveryCountLegacyFallback(
      payload.deliveryCountLegacyFallback,
      currentDeliveryCountLegacyFallback
    );
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const expectedPlanHash = computePlanHash(
    servicePhase,
    notificationPreset,
    notificationCaps,
    deliveryCountLegacyFallback
  );
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
    systemFlagsRepo.setNotificationPreset(notificationPreset),
    systemFlagsRepo.setNotificationCaps(notificationCaps),
    systemFlagsRepo.setDeliveryCountLegacyFallback(deliveryCountLegacyFallback)
  ]);

  await appendAuditLog({
    actor,
    action: 'system_config.set',
    entityType: 'system_flags',
    entityId: 'phase0',
    traceId,
    requestId,
    payloadSummary: { ok: true, servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    servicePhase,
    notificationPreset,
    notificationCaps,
    deliveryCountLegacyFallback
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleSet
};
