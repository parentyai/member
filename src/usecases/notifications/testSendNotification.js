'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateKillSwitch } = require('../../domain/validators');
const { recordSent } = require('../phase18/recordCtaStats');

function buildTextMessage(text) {
  return { type: 'text', text: text || '' };
}

async function testSendNotification(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const text = payload.text || 'test message';
  const pushFn = payload.pushFn || pushMessage;
  const notificationId = payload.notificationId || 'test';

  if (!lineUserId) {
    throw new Error('lineUserId required');
  }

  validateKillSwitch(payload.killSwitch);

  await pushFn(lineUserId, buildTextMessage(text));

  // Best-effort: do not let stats recording break sending.
  try {
    const notif = await notificationsRepo.getNotification(notificationId);
    const ctaText = notif && typeof notif.ctaText === 'string' ? notif.ctaText : null;
    const linkRegistryId = notif && typeof notif.linkRegistryId === 'string' ? notif.linkRegistryId : null;
    await recordSent({ notificationId, ctaText, linkRegistryId });
  } catch (_err) {
    // Intentionally ignored (member service mode must stay quiet; best-effort only).
  }

  const delivery = {
    notificationId,
    lineUserId,
    sentAt: payload.sentAt,
    delivered: true
  };
  const result = await deliveriesRepo.createDelivery(delivery);
  return { id: result.id };
}

module.exports = {
  testSendNotification
};
