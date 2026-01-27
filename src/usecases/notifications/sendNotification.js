'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateNotificationPayload } = require('../../domain/validators');

function buildTextMessage(notification) {
  const text = notification.body || notification.title || '';
  return { type: 'text', text };
}

async function sendNotification(params) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');

  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) throw new Error('notification not found');

  const linkEntry = await linkRegistryRepo.getLink(notification.linkRegistryId);
  if (!linkEntry) throw new Error('link registry entry not found');

  validateNotificationPayload(notification, linkEntry, payload.killSwitch);

  if (!notification.scenarioKey || !notification.stepKey) {
    throw new Error('scenarioKey/stepKey required');
  }

  const target = notification.target || {};
  if (!target || typeof target !== 'object') {
    throw new Error('target required');
  }

  const users = await usersRepo.listUsers({
    scenarioKey: notification.scenarioKey,
    stepKey: notification.stepKey,
    region: target.region,
    membersOnly: target.membersOnly,
    limit: target.limit
  });

  if (!users.length) {
    throw new Error('no recipients');
  }

  const pushFn = payload.pushFn || pushMessage;
  const message = buildTextMessage(notification);
  const sentAt = payload.sentAt;

  for (const user of users) {
    await pushFn(user.id, message);
    await deliveriesRepo.createDelivery({
      notificationId,
      lineUserId: user.id,
      sentAt,
      delivered: true
    });
  }

  await notificationsRepo.updateNotificationStatus(notificationId, {
    status: 'sent',
    sentAt: sentAt || null
  });

  return { notificationId, deliveredCount: users.length };
}

module.exports = {
  sendNotification
};
