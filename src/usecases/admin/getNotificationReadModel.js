'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { STEP_ORDER } = require('../../domain/constants');
const { evaluateNotificationPolicy } = require('../../domain/notificationPolicy');
const { normalizeNotificationCaps, evaluateNotificationCapsByCount, isQuietHoursActive } = require('../../domain/notificationCaps');
const { buildTemplateKey } = require('../adminOs/planNotificationSend');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const { getNotificationReactionSummary } = require('../phase137/getNotificationReactionSummary');
const { evaluateNotificationHealth } = require('../phase139/evaluateNotificationHealth');

const WAIT_RULE_TYPES = Object.freeze({
  '3mo': { type: 'TYPE_B', configured: false },
  '1mo': { type: 'TYPE_B', configured: false },
  week: { type: 'TYPE_B', configured: false },
  after1w: { type: 'TYPE_B', configured: false }
});

function resolveTrackBaseUrl() {
  const value = process.env.TRACK_BASE_URL;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.length ? trimmed : null;
}

function hasTrackTokenSecret() {
  const value = process.env.TRACK_TOKEN_SECRET;
  return typeof value === 'string' && value.trim().length > 0;
}

function isTrackingEnabled() {
  return Boolean(resolveTrackBaseUrl() && hasTrackTokenSecret());
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function computeLastSentAt(deliveries) {
  let latest = null;
  let latestMs = null;
  for (const delivery of deliveries) {
    const ms = toMillis(delivery && delivery.sentAt);
    if (ms && (!latestMs || ms > latestMs)) {
      latestMs = ms;
      latest = delivery.sentAt;
    }
  }
  return latest ? formatTimestamp(latest) : null;
}

function resolveStepIndex(stepKey) {
  if (!stepKey) return null;
  const idx = STEP_ORDER.indexOf(stepKey);
  if (idx === -1) return null;
  return idx + 1;
}

function resolveWaitRule(stepKey) {
  if (!stepKey) return { waitRuleType: null, waitRuleConfigured: false, waitRuleSource: 'ssot_unset' };
  const entry = WAIT_RULE_TYPES[stepKey];
  if (!entry) return { waitRuleType: null, waitRuleConfigured: false, waitRuleSource: 'ssot_unset' };
  return {
    waitRuleType: entry.type || null,
    waitRuleConfigured: entry.configured === true,
    waitRuleSource: entry.configured === true ? 'ssot_value' : 'ssot_unset'
  };
}

function resolveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  return null;
}

function resolvePlanSummary(auditLog) {
  if (!auditLog || typeof auditLog !== 'object') return null;
  const summary = auditLog.payloadSummary && typeof auditLog.payloadSummary === 'object' ? auditLog.payloadSummary : {};
  const snapshot = auditLog.snapshot && typeof auditLog.snapshot === 'object' ? auditLog.snapshot : {};
  const count = resolveNumber(summary.count) ?? resolveNumber(snapshot.count);
  const planHash = typeof summary.planHash === 'string' ? summary.planHash : (typeof snapshot.planHash === 'string' ? snapshot.planHash : null);
  const bucket = typeof summary.bucket === 'string' ? summary.bucket : (typeof snapshot.bucket === 'string' ? snapshot.bucket : null);
  const limit = resolveNumber(summary.limit) ?? resolveNumber(snapshot && snapshot.target && snapshot.target.limit);
  return {
    count,
    planHash,
    bucket,
    limit,
    traceId: typeof auditLog.traceId === 'string' ? auditLog.traceId : null,
    auditedAt: formatTimestamp(auditLog.createdAt)
  };
}

function resolveExecuteSummary(auditLog) {
  if (!auditLog || typeof auditLog !== 'object') return null;
  const summary = auditLog.payloadSummary && typeof auditLog.payloadSummary === 'object' ? auditLog.payloadSummary : {};
  return {
    ok: summary.ok === true,
    reason: typeof summary.reason === 'string' ? summary.reason : null,
    policyReason: typeof summary.policyReason === 'string' ? summary.policyReason : null,
    capBlockedSummary: summary.capBlockedSummary && typeof summary.capBlockedSummary === 'object'
      ? summary.capBlockedSummary
      : null,
    blockedByKillSwitch: summary.blockedByKillSwitch === true,
    traceId: typeof auditLog.traceId === 'string' ? auditLog.traceId : null,
    auditedAt: formatTimestamp(auditLog.createdAt)
  };
}

function buildCapSummary(params) {
  const payload = params || {};
  const caps = normalizeNotificationCaps(payload.notificationCaps);
  const now = payload.now instanceof Date ? payload.now : new Date();
  const capDecision = evaluateNotificationCapsByCount({
    notificationCaps: caps,
    now,
    deliveredCountWeekly: 0,
    deliveredCountDaily: 0,
    deliveredCountCategoryWeekly: 0,
    notificationCategory: payload.notificationCategory || null
  });
  const quietHoursActive = isQuietHoursActive(now, caps.quietHours);
  const allNull = caps.perUserWeeklyCap === null
    && caps.perUserDailyCap === null
    && caps.perCategoryWeeklyCap === null
    && caps.quietHours === null;
  return {
    configured: !allNull,
    decision: {
      allowed: capDecision.allowed,
      reason: capDecision.reason,
      capType: capDecision.capType
    },
    perUserWeeklyCap: caps.perUserWeeklyCap,
    perUserDailyCap: caps.perUserDailyCap,
    perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
    quietHours: caps.quietHours,
    quietHoursActive,
    countMode: payload.deliveryCountLegacyFallback === false ? 'delivered_at_only' : 'delivered_at_with_legacy',
    countSource: 'config_only'
  };
}

function buildSuppressionSummary(params) {
  const payload = params || {};
  return {
    dedupe: {
      enabled: true,
      strategy: 'delivery_id_reservation',
      skipStates: ['sealed', 'delivered', 'in_flight_or_unknown']
    },
    quietHoursActive: Boolean(payload.quietHoursActive),
    deliveryCountLegacyFallback: payload.deliveryCountLegacyFallback !== false
  };
}

async function getNotificationReadModel(params) {
  const opts = params || {};
  const trackingEnabled = isTrackingEnabled();
  const now = new Date();
  let servicePhase = null;
  let notificationPreset = null;
  let notificationCaps = normalizeNotificationCaps(null);
  let deliveryCountLegacyFallback = true;
  try {
    [servicePhase, notificationPreset, notificationCaps, deliveryCountLegacyFallback] = await Promise.all([
      systemFlagsRepo.getServicePhase(),
      systemFlagsRepo.getNotificationPreset(),
      systemFlagsRepo.getNotificationCaps(),
      systemFlagsRepo.getDeliveryCountLegacyFallback()
    ]);
  } catch (_err) {
    servicePhase = null;
    notificationPreset = null;
    notificationCaps = normalizeNotificationCaps(null);
    deliveryCountLegacyFallback = true;
  }
  let notifications = [];
  const notificationId = typeof opts.notificationId === 'string' ? opts.notificationId.trim() : '';
  if (notificationId) {
    const notification = await notificationsRepo.getNotification(notificationId);
    notifications = notification ? [notification] : [];
  } else {
    notifications = await notificationsRepo.listNotifications({
      limit: opts.limit,
      status: opts.status,
      scenarioKey: opts.scenarioKey,
      stepKey: opts.stepKey
    });
  }

  const items = [];
  for (const notification of notifications) {
    const templateKey = buildTemplateKey(notification.id);
    let planSummary = null;
    let executeSummary = null;
    try {
      const [planAudit, executeAudit] = await Promise.all([
        auditLogsRepo.getLatestAuditLog({ action: 'notifications.send.plan', templateKey }),
        auditLogsRepo.getLatestAuditLog({ action: 'notifications.send.execute', templateKey })
      ]);
      planSummary = resolvePlanSummary(planAudit);
      executeSummary = resolveExecuteSummary(executeAudit);
    } catch (_err) {
      planSummary = null;
      executeSummary = null;
    }
    const deliveries = await deliveriesRepo.listDeliveriesByNotificationId(notification.id);
    const lastSentAt = computeLastSentAt(deliveries);
    let deliveredCount = 0;
    let readCount = 0;
    let clickCount = 0;
    for (const delivery of deliveries) {
      deliveredCount += 1;
      if (delivery.readAt) readCount += 1;
      if (delivery.clickAt) clickCount += 1;
    }
    const reaction = await getNotificationReactionSummary({ notificationId: notification.id }, { deliveriesRepo: { listDeliveriesByNotificationId: async () => deliveries } });
    const reactionSummary = {
      sent: reaction.sent,
      clicked: reaction.clicked,
      ctr: reaction.ctr
    };
    const notificationHealth = evaluateNotificationHealth({ sent: reaction.sent, ctr: reaction.ctr });
    const notificationCategory = notification.notificationCategory || null;
    const policyDecision = evaluateNotificationPolicy({
      servicePhase,
      notificationPreset,
      notificationCategory
    });
    const policyAllowedCategories = Array.isArray(policyDecision.allowedCategories)
      ? policyDecision.allowedCategories.slice()
      : null;
    const policyConfigured = policyDecision.enforced === true;
    const capSummary = buildCapSummary({
      notificationCaps,
      notificationCategory,
      deliveryCountLegacyFallback,
      now
    });
    const suppressionSummary = buildSuppressionSummary({
      quietHoursActive: capSummary.quietHoursActive,
      deliveryCountLegacyFallback
    });
    const waitRule = resolveWaitRule(notification.stepKey);
    const target = notification.target && typeof notification.target === 'object' ? notification.target : {};
    const targetLimit = resolveNumber(target.limit);
    const targetCount = planSummary && Number.isFinite(planSummary.count) ? planSummary.count : null;
    const targetCountSource = targetCount !== null ? 'plan_audit' : (targetLimit !== null ? 'target_limit' : 'unknown');
    const item = {
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      stepIndex: resolveStepIndex(notification.stepKey),
      ctaText: notification.ctaText || null,
      linkRegistryId: notification.linkRegistryId || null,
      notificationCategory,
      trackingEnabled,
      policyDecision,
      policyAllowedCategories,
      policyConfigured,
      capSummary,
      suppressionSummary,
      targetCount,
      targetCountSource,
      targetLimit,
      targetRegion: typeof target.region === 'string' ? target.region : null,
      targetMembersOnly: target.membersOnly === true,
      planSummary,
      executeSummary,
      nextWaitDays: null,
      nextWaitDaysSource: waitRule.waitRuleSource,
      waitRuleType: waitRule.waitRuleType,
      waitRuleConfigured: waitRule.waitRuleConfigured,
      deliveredCount,
      readCount,
      clickCount,
      reactionSummary,
      notificationHealth,
      lastSentAt
    };
    item.decisionTrace = await getNotificationDecisionTrace(notification.id);
    item.completeness = evaluateNotificationSummaryCompleteness(item);
    items.push(item);
  }

  return items;
}

module.exports = {
  getNotificationReadModel
};
