'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const lineClient = require('../../infra/lineClient');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { createTrackToken } = require('../../domain/trackToken');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function resolveTrackBaseUrl() {
  const value = process.env.TRACK_BASE_URL;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.length ? trimmed : null;
}

function hasTrackTokenSecret() {
  const value = process.env.TRACK_TOKEN_SECRET;
  return typeof value === 'string' && value.trim().length > 0;
}

function buildTrackUrl(baseUrl, token) {
  if (!baseUrl || !token) return null;
  return `${baseUrl}/t/${encodeURIComponent(token)}`;
}

async function sendOpsNotice(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const text = requireString(payload.text, 'text');
  const decidedBy = requireString(payload.decidedBy || 'ops', 'decidedBy');
  const notificationId = payload.sourceNotificationId || null;
  const explicitLinkRegistryId = typeof payload.linkRegistryId === 'string' && payload.linkRegistryId.trim().length > 0
    ? payload.linkRegistryId.trim()
    : null;

  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const pushFn = deps && deps.pushMessage ? deps.pushMessage : lineClient.pushMessage;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const notifications = deps && deps.notificationsRepo ? deps.notificationsRepo : notificationsRepo;

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    return { ok: false, reason: 'kill_switch_on', status: 409 };
  }

  const trackBaseUrl = resolveTrackBaseUrl();
  const trackSecretOk = hasTrackTokenSecret();
  let linkRegistryId = explicitLinkRegistryId;
  if (!linkRegistryId && notificationId) {
    try {
      const notification = await notifications.getNotification(notificationId);
      const candidate = notification && typeof notification.linkRegistryId === 'string'
        ? notification.linkRegistryId.trim()
        : '';
      if (candidate) linkRegistryId = candidate;
    } catch (_err) {
      linkRegistryId = null;
    }
  }
  const trackEnabled = Boolean(trackBaseUrl && linkRegistryId && trackSecretOk);
  let finalText = text;
  let delivery = null;
  let trackedDeliveryId = null;
  if (trackEnabled) {
    try {
      const reservedId = typeof deliveries.reserveDeliveryId === 'function' ? deliveries.reserveDeliveryId() : null;
      if (reservedId) {
        const token = createTrackToken({ deliveryId: reservedId, linkRegistryId });
        const url = buildTrackUrl(trackBaseUrl, token);
        if (url) {
          trackedDeliveryId = reservedId;
          finalText = `${text}\n\n${url}`;
        }
      }
    } catch (_err) {
      finalText = text;
    }
  }

  await pushFn(lineUserId, { type: 'text', text: finalText });

  if (trackedDeliveryId && typeof deliveries.createDeliveryWithId === 'function') {
    delivery = await deliveries.createDeliveryWithId(trackedDeliveryId, {
      lineUserId,
      notificationId,
      text,
      decidedBy
    });
  } else if (!delivery) {
    delivery = await deliveries.createDelivery({
      lineUserId,
      notificationId,
      text,
      decidedBy
    });
  }

  const audit = await auditRepo.appendAuditLog({
    action: 'OPS_NOTICE_SENT',
    eventType: 'OPS_NOTICE_SENT',
    type: 'OPS_NOTICE_SENT',
    lineUserId,
    notificationId,
    text,
    decidedBy
  });

  return {
    ok: true,
    deliveryId: delivery.id,
    auditId: audit.id
  };
}

module.exports = {
  sendOpsNotice
};
