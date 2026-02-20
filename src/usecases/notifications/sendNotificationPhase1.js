'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersPhase1Repo = require('../../repos/firestore/usersPhase1Repo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateNotificationPayload } = require('../../domain/validators');
const { computeNotificationDeliveryId } = require('../../domain/deliveryId');

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
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;
  const actor = payload.actor || 'system';

  let deliveredCount = 0;

  for (const user of users) {
    const deliveryId = computeNotificationDeliveryId({
      notificationId,
      lineUserId: user.id
    });

    // Reserve delivery slot in a transaction to prevent duplicate sends across retries.
    const reserved = await deliveriesRepo.reserveDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId: user.id,
      sentAt: sentAt || null
    });

    // Skip users already delivered to.
    if (reserved.existing && reserved.existing.delivered === true) {
      continue;
    }

    await pushFn(user.id, buildTextMessage(notification));

    await deliveriesRepo.createDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId: user.id,
      delivered: true,
      deliveredAt: sentAt || new Date().toISOString(),
      sentAt: sentAt || null
    });

    deliveredCount += 1;

    // Best-effort timeline entry — failure must not block delivery.
    void decisionTimelineRepo.appendTimelineEntry({
      lineUserId: user.id,
      source: 'phase1',
      action: 'notification.sent',
      notificationId,
      deliveryId,
      traceId,
      requestId,
      actor
    }).catch(() => {});

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

  return { notificationId, deliveredCount };
}

module.exports = {
  sendNotificationPhase1
};
