'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersPhase1Repo = require('../../repos/firestore/usersPhase1Repo');
const { pushMessage } = require('../../infra/lineClient');
const { validateNotificationPayload } = require('../../domain/validators');

function buildTextMessage(notification) {
  const message = notification.message || {};
  const text = message.body || message.title || '';
  return { type: 'text', text };
}

async function sendNotificationPhase1(params) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');

  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) throw new Error('notification not found');

  if (!notification.scenario) {
    throw new Error('scenario required');
  }
  if (!notification.linkRegistryId) {
    throw new Error('linkRegistryId required');
  }

  const message = notification.message || {};
  if (!message.ctaText) throw new Error('message.ctaText required');

  const linkEntry = await linkRegistryRepo.getLink(notification.linkRegistryId);
  if (!linkEntry) throw new Error('link registry entry not found');

  validateNotificationPayload(
    { ctaText: message.ctaText, linkRegistryId: notification.linkRegistryId },
    linkEntry,
    payload.killSwitch
  );

  const users = await usersPhase1Repo.listUsersByScenario(notification.scenario, payload.limit);
  if (!users.length) throw new Error('no recipients');

  const pushFn = payload.pushFn || pushMessage;
  const sentAt = payload.sentAt;
  const eventLogger = payload.eventLogger;

  for (const user of users) {
    await pushFn(user.id, buildTextMessage(notification));
    await deliveriesRepo.createDelivery({
      notificationId,
      lineUserId: user.id,
      sentAt
    });
    if (eventLogger) {
      try {
        await eventLogger({ lineUserId: user.id, notificationId });
      } catch (err) {
        // best-effort: ignore event failure
      }
    }
  }

  await notificationsRepo.updateNotificationStatus(notificationId, {
    sentAt: sentAt || null
  });

  return { notificationId, deliveredCount: users.length };
}

module.exports = {
  sendNotificationPhase1
};
