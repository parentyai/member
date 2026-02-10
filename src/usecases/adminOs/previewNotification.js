'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');

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

async function previewNotification(params) {
  const payload = params || {};
  const notificationId = payload.notificationId || null;
  let notification = null;
  if (notificationId) {
    notification = await notificationsRepo.getNotification(notificationId);
    if (!notification) throw new Error('notification not found');
  } else {
    notification = payload;
  }

  const linkRegistryId = notification.linkRegistryId;
  if (!linkRegistryId) throw new Error('linkRegistryId required');
  const link = await linkRegistryRepo.getLink(linkRegistryId);
  if (!link) throw new Error('link registry entry not found');

  const trackBaseUrl = resolveTrackBaseUrl();
  const trackEnabled = Boolean(trackBaseUrl && hasTrackTokenSecret());
  const text = notification.body || notification.title || '';
  return {
    ok: true,
    notificationId: notificationId || null,
    messageText: text,
    linkRegistryId,
    linkUrl: link.url || null,
    linkHealthState: link.lastHealth && link.lastHealth.state ? link.lastHealth.state : null,
    trackEnabled,
    trackBaseUrl: trackEnabled ? trackBaseUrl : null
  };
}

module.exports = {
  previewNotification
};

