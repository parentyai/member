'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const { getNotificationReactionSummary } = require('../phase137/getNotificationReactionSummary');
const { evaluateNotificationHealth } = require('../phase139/evaluateNotificationHealth');
const { getLatestNotificationPlan, buildTemplateKey } = require('../adminOs/planNotificationSend');

const WAIT_RULE_TYPE = 'TYPE_B';
const WAIT_RULE_SOURCE_UNSET = 'ssot_unset';
const WAIT_RULE_SOURCE_VALUE = 'ssot_value';
const TARGET_COUNT_SOURCE_PLAN = 'plan_audit';
const TARGET_COUNT_SOURCE_MISSING = 'plan_missing';
const EXECUTE_REASON_MISSING = 'execute_missing';
const WEEK_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WAIT_RULE_VALUES = Object.freeze({
  '3mo': { baseDate: 'departureDate', offsetDays: -90 },
  '2mo': { baseDate: 'departureDate', offsetDays: -60 },
  '1mo': { baseDate: 'departureDate', offsetDays: -30 },
  week: { baseDate: 'departureDate', offsetDays: -7 },
  after1w: { baseDate: 'departureDate', offsetDays: 7 },
  after1mo: { baseDate: 'departureDate', offsetDays: 30 }
});

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

function computeWeekOverWeek(deliveries, now) {
  const nowMs = toMillis(now) || Date.now();
  const windowMs = WEEK_WINDOW_DAYS * MS_PER_DAY;
  const currentStart = nowMs - windowMs;
  const previousStart = currentStart - windowMs;
  const current = { sent: 0, read: 0, click: 0 };
  const previous = { sent: 0, read: 0, click: 0 };

  for (const delivery of deliveries) {
    const sentMs = toMillis(delivery && (delivery.sentAt || delivery.deliveredAt));
    if (sentMs) {
      if (sentMs >= currentStart && sentMs < nowMs) current.sent += 1;
      else if (sentMs >= previousStart && sentMs < currentStart) previous.sent += 1;
    }
    const readMs = toMillis(delivery && delivery.readAt);
    if (readMs) {
      if (readMs >= currentStart && readMs < nowMs) current.read += 1;
      else if (readMs >= previousStart && readMs < currentStart) previous.read += 1;
    }
    const clickMs = toMillis(delivery && delivery.clickAt);
    if (clickMs) {
      if (clickMs >= currentStart && clickMs < nowMs) current.click += 1;
      else if (clickMs >= previousStart && clickMs < currentStart) previous.click += 1;
    }
  }

  const currentCtr = current.sent ? current.click / current.sent : 0;
  const previousCtr = previous.sent ? previous.click / previous.sent : 0;

  return {
    windowDays: WEEK_WINDOW_DAYS,
    current: {
      sent: current.sent,
      read: current.read,
      click: current.click,
      ctr: currentCtr
    },
    previous: {
      sent: previous.sent,
      read: previous.read,
      click: previous.click,
      ctr: previousCtr
    },
    delta: {
      sent: current.sent - previous.sent,
      read: current.read - previous.read,
      click: current.click - previous.click,
      ctr: currentCtr - previousCtr
    }
  };
}

function resolveWaitRule(stepKey) {
  const rule = WAIT_RULE_VALUES[stepKey];
  const baseDate = rule && typeof rule.baseDate === 'string' ? rule.baseDate : null;
  const offsetDays = rule && typeof rule.offsetDays === 'number' ? rule.offsetDays : null;
  const configured = Boolean(baseDate) && typeof offsetDays === 'number';
  return {
    waitRuleType: rule ? WAIT_RULE_TYPE : null,
    waitRuleConfigured: configured,
    nextWaitDays: configured ? offsetDays : null,
    nextWaitDaysSource: configured ? WAIT_RULE_SOURCE_VALUE : WAIT_RULE_SOURCE_UNSET
  };
}

async function resolveTargetCount(notificationId) {
  let targetCount = null;
  let targetCountSource = TARGET_COUNT_SOURCE_MISSING;
  if (!notificationId) {
    return { targetCount, targetCountSource };
  }
  try {
    const latestPlan = await getLatestNotificationPlan(notificationId);
    const payloadCount = latestPlan && latestPlan.payloadSummary ? latestPlan.payloadSummary.count : null;
    const snapshotCount = latestPlan && latestPlan.snapshot ? latestPlan.snapshot.count : null;
    const count = typeof payloadCount === 'number' ? payloadCount : (typeof snapshotCount === 'number' ? snapshotCount : null);
    if (typeof count === 'number') {
      targetCount = count;
      targetCountSource = TARGET_COUNT_SOURCE_PLAN;
    }
  } catch (_err) {
    // best-effort only
  }
  return { targetCount, targetCountSource };
}

async function resolveExecuteSummary(notificationId) {
  const empty = {
    lastExecuteReason: EXECUTE_REASON_MISSING,
    capCountMode: null,
    capCountSource: null,
    capCountStrategy: null
  };
  if (!notificationId) return empty;
  try {
    const latest = await auditLogsRepo.getLatestAuditLog({
      action: 'notifications.send.execute',
      templateKey: buildTemplateKey(notificationId)
    });
    if (!latest || !latest.payloadSummary) return empty;
    const summary = latest.payloadSummary;
    return {
      lastExecuteReason: summary.reason || null,
      capCountMode: summary.capCountMode || null,
      capCountSource: summary.capCountSource || null,
      capCountStrategy: summary.capCountStrategy || null
    };
  } catch (_err) {
    return empty;
  }
}

async function getNotificationReadModel(params) {
  const opts = params || {};
  const now = opts.now instanceof Date ? opts.now : new Date();
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
    const waitRule = resolveWaitRule(notification.stepKey);
    const { targetCount, targetCountSource } = await resolveTargetCount(notification.id);
    const executeSummary = await resolveExecuteSummary(notification.id);
    const reaction = await getNotificationReactionSummary({ notificationId: notification.id }, { deliveriesRepo: { listDeliveriesByNotificationId: async () => deliveries } });
    const reactionSummary = {
      sent: reaction.sent,
      clicked: reaction.clicked,
      ctr: reaction.ctr
    };
    const notificationHealth = evaluateNotificationHealth({ sent: reaction.sent, ctr: reaction.ctr });
    const weekOverWeek = computeWeekOverWeek(deliveries, now);
    const item = {
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      ctaText: notification.ctaText || null,
      linkRegistryId: notification.linkRegistryId || null,
      targetCount,
      targetCountSource,
      lastExecuteReason: executeSummary.lastExecuteReason,
      capCountMode: executeSummary.capCountMode,
      capCountSource: executeSummary.capCountSource,
      capCountStrategy: executeSummary.capCountStrategy,
      deliveredCount,
      readCount,
      clickCount,
      reactionSummary,
      notificationHealth,
      weekOverWeek,
      lastSentAt,
      waitRuleType: waitRule.waitRuleType,
      waitRuleConfigured: waitRule.waitRuleConfigured,
      nextWaitDays: waitRule.nextWaitDays,
      nextWaitDaysSource: waitRule.nextWaitDaysSource
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
