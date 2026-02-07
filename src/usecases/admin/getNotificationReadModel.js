'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { evaluateNotificationSummaryCompleteness } = require('../phase24/notificationSummaryCompleteness');

async function getNotificationReadModel(params) {
  const opts = params || {};
  const notifications = await notificationsRepo.listNotifications({
    limit: opts.limit,
    status: opts.status,
    scenarioKey: opts.scenarioKey,
    stepKey: opts.stepKey
  });

  const items = [];
  for (const notification of notifications) {
    const deliveries = await deliveriesRepo.listDeliveriesByNotificationId(notification.id);
    let deliveredCount = 0;
    let readCount = 0;
    let clickCount = 0;
    for (const delivery of deliveries) {
      deliveredCount += 1;
      if (delivery.readAt) readCount += 1;
      if (delivery.clickAt) clickCount += 1;
    }
    const item = {
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      ctaText: notification.ctaText || null,
      linkRegistryId: notification.linkRegistryId || null,
      deliveredCount,
      readCount,
      clickCount
    };
    item.completeness = evaluateNotificationSummaryCompleteness(item);
    items.push(item);
  }

  return items;
}

module.exports = {
  getNotificationReadModel
};
