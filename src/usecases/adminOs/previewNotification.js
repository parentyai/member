'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { validateWarnLinkBlock, resolveNotificationCtas } = require('../../domain/validators');
const { buildLineNotificationMessage } = require('../notifications/buildLineNotificationMessage');

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

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
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

  const multiCtaEnabled = resolveBooleanEnvFlag('ENABLE_NOTIFICATION_CTA_MULTI_V1', false);
  const ctaSlots = resolveNotificationCtas(notification, {
    allowSecondary: multiCtaEnabled,
    ignoreSecondary: false,
    minTotal: 1,
    maxSecondary: multiCtaEnabled ? 2 : 0,
    maxTotal: multiCtaEnabled ? 3 : 1
  });
  const previewCtas = [];
  for (const slot of ctaSlots) {
    const link = await linkRegistryRepo.getLink(slot.linkRegistryId);
    if (!link) throw new Error('link registry entry not found');
    validateWarnLinkBlock(link);
    previewCtas.push({
      slot: slot.slot,
      ctaText: slot.ctaText,
      linkRegistryId: slot.linkRegistryId,
      linkUrl: link.url || null,
      linkHealthState: link.lastHealth && link.lastHealth.state ? link.lastHealth.state : null
    });
  }

  const trackBaseUrl = resolveTrackBaseUrl();
  const trackEnabled = Boolean(trackBaseUrl && hasTrackTokenSecret());
  const text = notification.body || notification.title || '';
  const lineButtonsEnabled = resolveBooleanEnvFlag('ENABLE_LINE_CTA_BUTTONS_V1', false);
  const linePreview = buildLineNotificationMessage({
    notification,
    ctas: previewCtas.map((item) => ({
      ctaText: item.ctaText,
      linkRegistryId: item.linkRegistryId,
      url: item.linkUrl,
      originalUrl: item.linkUrl
    })),
    preferTemplateButtons: lineButtonsEnabled
  });
  const primary = previewCtas[0] || null;

  return {
    ok: true,
    notificationId: notificationId || null,
    messageText: text,
    linkRegistryId: primary ? primary.linkRegistryId : null,
    linkUrl: primary ? primary.linkUrl : null,
    linkHealthState: primary ? primary.linkHealthState : null,
    ctaCount: previewCtas.length,
    ctaSlots: previewCtas,
    ctaLinkRegistryIds: previewCtas.map((item) => item.linkRegistryId),
    lineMessageType: linePreview.lineMessageType,
    trackEnabled,
    trackBaseUrl: trackEnabled ? trackBaseUrl : null
  };
}

module.exports = {
  previewNotification
};
