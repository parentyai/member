'use strict';

const crypto = require('crypto');

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const {
  normalizeNotificationCaps,
  resolveWeeklyWindowStart,
  resolveDailyWindowStart,
  isQuietHoursActive,
  evaluateNotificationCapsByCount
} = require('../../domain/notificationCaps');
const { NOTIFICATION_CATEGORIES } = require('../../domain/notificationCategory');
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

function sumCounterValues(counter) {
  let total = 0;
  for (const value of Object.values(counter || {})) {
    if (!Number.isFinite(value)) continue;
    total += value;
  }
  return total;
}

function pickTopCounterKey(counter) {
  let topKey = null;
  let topCount = -1;
  for (const [key, value] of Object.entries(counter || {})) {
    const count = Number.isFinite(value) ? value : 0;
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }
  return topKey;
}

function toPercent(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildQuietHoursImpactPreview(users, categories, includeLegacyFallback) {
  const sampledUsers = Array.isArray(users) ? users.length : 0;
  const categoryList = Array.isArray(categories) ? categories : [null];
  const sampledEvaluations = sampledUsers * categoryList.length;
  const blockedByCategory = {};
  if (categoryList.length === 1 && categoryList[0] === null) {
    blockedByCategory.UNCATEGORIZED = sampledEvaluations;
  } else {
    for (const category of categoryList) {
      if (typeof category !== 'string') continue;
      blockedByCategory[category] = sampledUsers;
    }
  }
  const notes = ['quietHours evaluated in UTC', 'quietHours preview blocks all send attempts during active window'];
  if (!includeLegacyFallback) notes.push('deliveryCountLegacyFallback=false (count queries skipped by quietHours)');

  return {
    sampledUsers,
    sampledEvaluations,
    blockedEvaluations: sampledEvaluations,
    estimatedBlockedUsers: sampledUsers,
    estimatedBlockedUserRatePercent: toPercent(sampledUsers, sampledUsers),
    blockedEvaluationRatePercent: toPercent(sampledEvaluations, sampledEvaluations),
    simulatedCategories: categoryList.filter((v) => typeof v === 'string'),
    blockedByCapType: { QUIET_HOURS: sampledEvaluations },
    blockedByCategory,
    blockedByReason: { quiet_hours_active: sampledEvaluations },
    topBlockedCapType: sampledEvaluations > 0 ? 'QUIET_HOURS' : null,
    topBlockedCategory: pickTopCounterKey(blockedByCategory),
    notes
  };
}

async function buildImpactPreview(notificationCaps, options) {
  const caps = normalizeNotificationCaps(notificationCaps);
  const opts = options && typeof options === 'object' ? options : {};
  const includeLegacyFallback = opts.deliveryCountLegacyFallback !== false;
  const sampleLimit = Number.isInteger(opts.sampleLimit) && opts.sampleLimit > 0 ? opts.sampleLimit : 100;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const allNull = caps.perUserWeeklyCap === null
    && caps.perUserDailyCap === null
    && caps.perCategoryWeeklyCap === null
    && caps.quietHours === null;
  if (allNull) {
    return {
      sampledUsers: 0,
      sampledEvaluations: 0,
      blockedEvaluations: 0,
      estimatedBlockedUsers: 0,
      estimatedBlockedUserRatePercent: 0,
      blockedEvaluationRatePercent: 0,
      simulatedCategories: [],
      blockedByCapType: {},
      blockedByCategory: {},
      blockedByReason: {},
      topBlockedCapType: null,
      topBlockedCategory: null,
      notes: ['caps_disabled']
    };
  }

  const categories = caps.perCategoryWeeklyCap !== null ? NOTIFICATION_CATEGORIES : [null];
  const categoryTargets = caps.perCategoryWeeklyCap !== null ? NOTIFICATION_CATEGORIES : [];
  let users;
  try {
    users = await usersRepo.listUsers({ limit: sampleLimit });
  } catch (_err) {
    return {
      sampledUsers: 0,
      sampledEvaluations: 0,
      blockedEvaluations: 0,
      estimatedBlockedUsers: null,
      estimatedBlockedUserRatePercent: null,
      blockedEvaluationRatePercent: null,
      simulatedCategories: [],
      blockedByCapType: {},
      blockedByCategory: {},
      blockedByReason: {},
      topBlockedCapType: null,
      topBlockedCategory: null,
      notes: ['preview_unavailable']
    };
  }

  if (isQuietHoursActive(now, caps.quietHours)) {
    return buildQuietHoursImpactPreview(users, categories, includeLegacyFallback);
  }

  const weeklyWindowStart = resolveWeeklyWindowStart(now);
  const dailyWindowStart = resolveDailyWindowStart(now);

  const blockedByCapType = {};
  const blockedByCategory = {};
  const blockedByReason = {};
  const blockedUsers = new Set();
  let sampledEvaluations = 0;
  let skippedUsersForCountErrors = 0;
  for (const user of users) {
    const lineUserId = user && typeof user.id === 'string' ? user.id : null;
    if (!lineUserId) continue;
    const countOptions = { includeLegacyFallback };
    const deliveredCountByCategoryWeekly = {};
    let deliveredCountWeekly = 0;
    let deliveredCountDaily = 0;
    try {
      const snapshot = await deliveriesRepo.getDeliveredCountsSnapshot(lineUserId, {
        weeklySinceAt: weeklyWindowStart,
        dailySinceAt: caps.perUserDailyCap !== null ? dailyWindowStart : null,
        categories: categoryTargets,
        includeLegacyFallback: countOptions.includeLegacyFallback
      });
      if (caps.perUserWeeklyCap !== null) {
        deliveredCountWeekly = Number.isFinite(snapshot.weeklyCount) ? snapshot.weeklyCount : 0;
      }
      if (caps.perUserDailyCap !== null) {
        deliveredCountDaily = Number.isFinite(snapshot.dailyCount) ? snapshot.dailyCount : 0;
      }
      const byCategory = snapshot.categoryWeeklyCounts && typeof snapshot.categoryWeeklyCounts === 'object'
        ? snapshot.categoryWeeklyCounts
        : {};
      for (const category of categoryTargets) {
        deliveredCountByCategoryWeekly[category] = Number.isFinite(byCategory[category]) ? byCategory[category] : 0;
      }
    } catch (_err) {
      skippedUsersForCountErrors += 1;
      continue;
    }

    for (const category of categories) {
      const deliveredCountCategoryWeekly = category
        ? (deliveredCountByCategoryWeekly[category] || 0)
        : 0;
      const result = evaluateNotificationCapsByCount({
        now,
        notificationCaps: caps,
        deliveredCountWeekly,
        deliveredCountDaily,
        deliveredCountCategoryWeekly,
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
  const estimatedBlockedUsers = blockedUsers.size;
  const blockedEvaluations = sumCounterValues(blockedByReason);

  const notes = [];
  if (caps.perCategoryWeeklyCap !== null) notes.push('perCategoryWeeklyCap preview simulates all categories');
  if (caps.quietHours) notes.push('quietHours evaluated in UTC');
  if (!includeLegacyFallback) notes.push('deliveryCountLegacyFallback=false (deliveredAt only)');
  if (skippedUsersForCountErrors > 0) {
    notes.push(`users_skipped_for_count_errors=${skippedUsersForCountErrors}`);
  }

  return {
    sampledUsers: users.length,
    sampledEvaluations,
    blockedEvaluations,
    estimatedBlockedUsers,
    estimatedBlockedUserRatePercent: toPercent(estimatedBlockedUsers, users.length),
    blockedEvaluationRatePercent: toPercent(blockedEvaluations, sampledEvaluations),
    simulatedCategories: categories.filter((v) => typeof v === 'string'),
    blockedByCapType,
    blockedByCategory,
    blockedByReason,
    topBlockedCapType: pickTopCounterKey(blockedByCapType),
    topBlockedCategory: pickTopCounterKey(blockedByCategory),
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
  const impactPreview = await buildImpactPreview(notificationCaps, { deliveryCountLegacyFallback });

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
        blockedEvaluations: impactPreview.blockedEvaluations,
        estimatedBlockedUsers: impactPreview.estimatedBlockedUsers,
        estimatedBlockedUserRatePercent: impactPreview.estimatedBlockedUserRatePercent,
        blockedEvaluationRatePercent: impactPreview.blockedEvaluationRatePercent,
        blockedByCapType: impactPreview.blockedByCapType,
        blockedByCategory: impactPreview.blockedByCategory,
        blockedByReason: impactPreview.blockedByReason
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
