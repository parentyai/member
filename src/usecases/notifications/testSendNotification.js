'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { pushMessage } = require('../../infra/lineClient');
const { computeLineRetryKey } = require('../../domain/deliveryId');
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
    const reserved = await deliveriesRepo.reserveDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId
    });
    const existing = reserved && reserved.existing ? reserved.existing : null;
    if (existing && existing.sealed === true) return { id: deliveryId, skipped: true };
    if (existing && existing.delivered === true) return { id: deliveryId, skipped: true };
    // If the delivery exists but isn't marked failed, treat it as in-flight/unknown and skip.
    // This prevents duplicates if the process crashed after pushing but before marking delivered.
    if (existing && existing.delivered !== true && !existing.lastError) return { id: deliveryId, skipped: true };
  }

  try {
    if (deliveryId) {
      await pushFn(lineUserId, buildTextMessage(text), { retryKey: computeLineRetryKey({ deliveryId }) });
    } else {
      await pushFn(lineUserId, buildTextMessage(text));
    }
  } catch (err) {
    if (deliveryId) {
      try {
        await deliveriesRepo.createDeliveryWithId(deliveryId, {
          notificationId,
          lineUserId,
          sentAt: null,
          delivered: false,
          state: 'failed',
          lastError: err && err.message ? String(err.message) : 'send failed',
          lastErrorAt: payload.sentAt || undefined
        });
      } catch (_ignored) {
        // best-effort only
      }
    }
    throw err;
  }

  const delivery = {
    notificationId,
    lineUserId,
    sentAt: payload.sentAt,
    delivered: true
  };
  const result = deliveryId
    ? await deliveriesRepo.createDeliveryWithId(deliveryId, Object.assign({}, delivery, {
      state: 'delivered',
      deliveredAt: payload.sentAt || undefined,
      lastError: null,
      lastErrorAt: null
    }))
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
