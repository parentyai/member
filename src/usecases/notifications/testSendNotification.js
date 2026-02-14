'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
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
  const notificationCategory = typeof payload.notificationCategory === 'string' && payload.notificationCategory.trim().length > 0
    ? payload.notificationCategory.trim().toUpperCase()
    : null;
  const deliveryId = typeof payload.deliveryId === 'string' && payload.deliveryId.trim().length > 0
    ? payload.deliveryId.trim()
    : null;
  const sentAt = payload.sentAt || new Date().toISOString();
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0
    ? payload.traceId.trim()
    : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0
    ? payload.actor.trim()
    : null;
  const timelineSource = typeof payload.timelineSource === 'string' && payload.timelineSource.trim().length > 0
    ? payload.timelineSource.trim()
    : 'notification';
  const timelineAction = typeof payload.timelineAction === 'string' && payload.timelineAction.trim().length > 0
    ? payload.timelineAction.trim()
    : 'NOTIFY';
  const timelineRefId = typeof payload.timelineRefId === 'string' && payload.timelineRefId.trim().length > 0
    ? payload.timelineRefId.trim()
    : notificationId;

  async function appendTimelineEntry(snapshot) {
    if (!traceId) return;
    try {
      await decisionTimelineRepo.appendTimelineEntry({
        lineUserId,
        source: timelineSource,
        action: timelineAction,
        refId: timelineRefId,
        notificationId,
        traceId,
        requestId: requestId || undefined,
        actor: actor || undefined,
        snapshot
      });
    } catch (_err) {
      // best-effort only
    }
  }

  if (!lineUserId) {
    throw new Error('lineUserId required');
  }

  validateKillSwitch(payload.killSwitch);

  if (deliveryId) {
    const reserved = await deliveriesRepo.reserveDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId,
      notificationCategory
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
          notificationCategory,
          sentAt: null,
          delivered: false,
          state: 'failed',
          lastError: err && err.message ? String(err.message) : 'send failed',
          lastErrorAt: sentAt
        });
      } catch (_ignored) {
        // best-effort only
      }
    }
    await appendTimelineEntry({
      ok: false,
      delivered: false,
      sentAt: null,
      error: err && err.message ? String(err.message) : 'send failed',
      deliveryId: deliveryId || null,
      notificationCategory
    });
    throw err;
  }

  const delivery = {
    notificationId,
    lineUserId,
    notificationCategory,
    sentAt,
    delivered: true
  };
  const result = deliveryId
    ? await deliveriesRepo.createDeliveryWithId(deliveryId, Object.assign({}, delivery, {
      state: 'delivered',
      deliveredAt: sentAt,
      lastError: null,
      lastErrorAt: null
    }))
    : await deliveriesRepo.createDelivery(delivery);
  await appendTimelineEntry({
    ok: true,
    delivered: true,
    sentAt,
    deliveryId: deliveryId || null,
    notificationCategory
  });

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
