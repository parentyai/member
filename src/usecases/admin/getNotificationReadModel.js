'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const { getNotificationReactionSummary } = require('../phase137/getNotificationReactionSummary');
const { evaluateNotificationHealth } = require('../phase139/evaluateNotificationHealth');

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
