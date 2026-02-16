'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const { getNotificationReactionSummary } = require('../phase137/getNotificationReactionSummary');
const { evaluateNotificationHealth } = require('../phase139/evaluateNotificationHealth');

const WAIT_RULE_TYPE = 'TYPE_B';
const WAIT_RULE_SOURCE_UNSET = 'ssot_unset';
const WAIT_RULE_SOURCE_VALUE = 'ssot_value';
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

async function getNotificationReadModel(params) {
  const opts = params || {};
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
    const reaction = await getNotificationReactionSummary({ notificationId: notification.id }, { deliveriesRepo: { listDeliveriesByNotificationId: async () => deliveries } });
    const reactionSummary = {
      sent: reaction.sent,
      clicked: reaction.clicked,
      ctr: reaction.ctr
    };
    const notificationHealth = evaluateNotificationHealth({ sent: reaction.sent, ctr: reaction.ctr });
    const item = {
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      ctaText: notification.ctaText || null,
      linkRegistryId: notification.linkRegistryId || null,
      deliveredCount,
      readCount,
      clickCount,
      reactionSummary,
      notificationHealth,
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
