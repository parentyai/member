'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateNotificationPayload } = require('../../domain/validators');
const { recordSent } = require('../phase18/recordCtaStats');
const { createTrackToken } = require('../../domain/trackToken');
const { computeNotificationDeliveryId, computeLineRetryKey } = require('../../domain/deliveryId');

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

function buildTextMessage(notification, originalUrl, trackUrl) {
  const text = notification.body || notification.title || '';
  if (!trackUrl) return { type: 'text', text };

  let withLink = text;
  if (originalUrl && withLink.includes(originalUrl)) {
    withLink = withLink.split(originalUrl).join(trackUrl);
  } else {
    withLink = `${text}\n\n${trackUrl}`;
  }
  return { type: 'text', text: withLink };
}

function normalizeLineUserIds(ids) {
  if (!Array.isArray(ids)) return [];
  const normalized = ids
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id) => id.length > 0);
  return Array.from(new Set(normalized)).sort();
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

  const overrideLineUserIds = normalizeLineUserIds(payload.lineUserIds);
  const effectiveUsers = overrideLineUserIds.length
    ? overrideLineUserIds.map((id) => ({ id }))
    : users;

  if (!effectiveUsers.length) {
    throw new Error('no recipients');
  }

  const pushFn = payload.pushFn || pushMessage;
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
  const trackBaseUrl = resolveTrackBaseUrl();
  const trackEnabled = Boolean(trackBaseUrl && hasTrackTokenSecret());

  let deliveredCount = 0;
  let skippedCount = 0;

  for (const user of effectiveUsers) {
    const deliveryId = computeNotificationDeliveryId({ notificationId, lineUserId: user.id });
    const reserved = await deliveriesRepo.reserveDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId: user.id,
      notificationCategory: notification.notificationCategory || null
    });
    const existing = reserved && reserved.existing ? reserved.existing : null;
    if (existing && existing.sealed === true) {
      skippedCount += 1;
      continue;
    }
    if (existing && existing.delivered === true) {
      skippedCount += 1;
      continue;
    }
    // If the delivery exists but isn't marked failed, treat it as in-flight/unknown and skip.
    // This prevents duplicates if the process crashed after pushing but before marking delivered.
    if (existing && existing.delivered !== true && !existing.lastError) {
      skippedCount += 1;
      continue;
    }

    let trackUrl = null;
    if (trackEnabled) {
      try {
        const token = createTrackToken({ deliveryId, linkRegistryId: notification.linkRegistryId });
        const url = buildTrackUrl(trackBaseUrl, token);
        if (url) {
          trackUrl = url;
        }
      } catch (_err) {
        trackUrl = null;
      }
    }
    const message = buildTextMessage(notification, linkEntry.url, trackUrl);
    try {
      await pushFn(user.id, message, { retryKey: computeLineRetryKey({ deliveryId }) });
      deliveredCount += 1;
      await deliveriesRepo.createDeliveryWithId(deliveryId, {
        notificationId,
        lineUserId: user.id,
        notificationCategory: notification.notificationCategory || null,
        sentAt,
        delivered: true,
        state: 'delivered',
        deliveredAt: sentAt,
        lastError: null,
        lastErrorAt: null
      });
    } catch (err) {
      try {
        await deliveriesRepo.createDeliveryWithId(deliveryId, {
          notificationId,
          lineUserId: user.id,
          notificationCategory: notification.notificationCategory || null,
          sentAt: null,
          delivered: false,
          state: 'failed',
          lastError: err && err.message ? String(err.message) : 'send failed',
          lastErrorAt: sentAt
        });
      } catch (_ignored) {
        // best-effort only
      }
      throw err;
    }
    try {
      await decisionTimelineRepo.appendTimelineEntry({
        lineUserId: user.id,
        source: 'notification',
        action: 'NOTIFY',
        refId: notificationId,
        notificationId,
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        actor: actor || undefined,
        snapshot: {
          delivered: true,
          sentAt: sentAt || null
        }
      });
    } catch (err) {
      // best-effort only
    }
    try {
      await recordSent({
        notificationId,
        ctaText: notification.ctaText || null,
        linkRegistryId: notification.linkRegistryId || null
      });
    } catch (err) {
      // WIP: Phase18 CTA stats should not block delivery
    }
  }

  await notificationsRepo.updateNotificationStatus(notificationId, {
    status: 'sent',
    sentAt: sentAt || null
  });

  return { notificationId, deliveredCount, skippedCount };
}

module.exports = {
  sendNotification
};
