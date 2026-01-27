'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');

async function getInbox(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const deliveries = await deliveriesRepo.listDeliveriesByUser(payload.lineUserId, payload.limit);
  const items = [];
  for (const delivery of deliveries) {
    const notification = await notificationsRepo.getNotification(delivery.notificationId);
    items.push({
      deliveryId: delivery.id,
      notificationId: delivery.notificationId,
      title: notification ? notification.title : null,
      body: notification ? notification.body : null,
      ctaText: notification ? notification.ctaText : null,
      sentAt: delivery.sentAt || null,
      readAt: delivery.readAt || null,
      clickAt: delivery.clickAt || null
    });
  }
  return items;
}

module.exports = {
  getInbox
};
