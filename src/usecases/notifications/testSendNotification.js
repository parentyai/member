'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateKillSwitch } = require('../../domain/validators');
const { recordSent } = require('../phase18/recordCtaStats');

function buildTextMessage(text) {
  return { type: 'text', text: text || '' };
}

function logSentWriteError(fields) {
  if (process.env.SERVICE_MODE !== 'track') return;
  const parts = ['[OBS] action=sent-write result=error'];
  if (fields && fields.notificationId) parts.push(`notificationId=${fields.notificationId}`);
  if (fields && fields.lineUserId) parts.push(`lineUserId=${fields.lineUserId}`);
  console.log(parts.join(' '));
}

async function testSendNotification(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const text = payload.text || 'test message';
  const pushFn = payload.pushFn || pushMessage;
  const notificationId = payload.notificationId || 'test';
  const deliveryId = typeof payload.deliveryId === 'string' && payload.deliveryId.trim().length > 0
    ? payload.deliveryId.trim()
    : null;

  if (!lineUserId) {
    throw new Error('lineUserId required');
  }

  validateKillSwitch(payload.killSwitch);

  if (deliveryId) {
    const existing = await deliveriesRepo.getDelivery(deliveryId);
    if (existing && existing.delivered) {
      return { id: deliveryId, skipped: true };
    }
  }

  await pushFn(lineUserId, buildTextMessage(text));

  const delivery = {
    notificationId,
    lineUserId,
    sentAt: payload.sentAt,
    delivered: true
  };
  const result = deliveryId
    ? await deliveriesRepo.createDeliveryWithId(deliveryId, delivery)
    : await deliveriesRepo.createDelivery(delivery);

  // Best-effort: do not let stats recording break sending.
  try {
    const notif = await notificationsRepo.getNotification(notificationId);
    const ctaText = notif && typeof notif.ctaText === 'string' ? notif.ctaText : null;
    const linkRegistryId = notif && typeof notif.linkRegistryId === 'string' ? notif.linkRegistryId : null;
    await recordSent({ notificationId, ctaText, linkRegistryId });
  } catch (_err) {
    logSentWriteError({ notificationId, lineUserId });
  }

  return { id: result.id };
}

module.exports = {
  testSendNotification
};
