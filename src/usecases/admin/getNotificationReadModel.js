'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');

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
    items.push({
      notificationId: notification.id,
      title: notification.title || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      deliveredCount,
      readCount,
      clickCount
    });
  }

  return items;
}

module.exports = {
  getNotificationReadModel
};
