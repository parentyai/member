'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { validateWarnLinkBlock, resolveNotificationCtas } = require('../../domain/validators');
const { recordClick } = require('../phase18/recordCtaStats');

function normalizeCtaSlot(value) {
  if (typeof value !== 'string') return null;
  const slot = value.trim().toLowerCase();
  if (slot === 'primary' || slot === 'secondary1' || slot === 'secondary2') return slot;
  return null;
}

function resolveCtaTextBySlot(notification, ctaSlot) {
  if (!notification || typeof notification !== 'object') return null;
  if (!ctaSlot) return typeof notification.ctaText === 'string' ? notification.ctaText || null : null;
  try {
    const ctas = resolveNotificationCtas(notification, {
      allowSecondary: true,
      ignoreSecondary: false,
      minTotal: 1,
      maxSecondary: 2,
      maxTotal: 3
    });
    const match = ctas.find((item) => item.slot === ctaSlot);
    if (match) return match.ctaText;
  } catch (_err) {
    // no-op
  }
  return typeof notification.ctaText === 'string' ? notification.ctaText || null : null;
}

async function recordClickAndRedirect(params) {
  const payload = params || {};
  if (!payload.deliveryId) throw new Error('deliveryId required');
  if (!payload.linkRegistryId) throw new Error('linkRegistryId required');
  const ctaSlot = normalizeCtaSlot(payload.ctaSlot);

  const linkEntry = await linkRegistryRepo.getLink(payload.linkRegistryId);
  if (!linkEntry || !linkEntry.url) {
    throw new Error('link registry entry not found');
  }

  validateWarnLinkBlock(linkEntry);

  await deliveriesRepo.markClick(payload.deliveryId, payload.at);
  try {
    const delivery = await deliveriesRepo.getDelivery(payload.deliveryId);
    if (delivery && delivery.notificationId) {
      const notification = await notificationsRepo.getNotification(delivery.notificationId);
      const ctaText = resolveCtaTextBySlot(notification, ctaSlot);
      const wrote = await recordClick({
        notificationId: delivery.notificationId,
        ctaText,
        linkRegistryId: payload.linkRegistryId || null,
        ctaSlot
      });
      if (process.env.SERVICE_MODE === 'track') {
        const parts = ['[OBS] action=click-write', `result=${wrote ? 'ok' : 'skip'}`, `deliveryId=${payload.deliveryId}`];
        if (ctaText) parts.push(`ctaText=${ctaText}`);
        if (payload.linkRegistryId) parts.push(`linkRegistryId=${payload.linkRegistryId}`);
        if (ctaSlot) parts.push(`ctaSlot=${ctaSlot}`);
        console.log(parts.join(' '));
      }
    }
  } catch (err) {
    // CTA stats failure must not block click tracking — best-effort only.
    if (process.env.SERVICE_MODE === 'track') {
      const message = err && err.message ? err.message : 'error';
      const parts = ['[OBS] action=click-write', 'result=error', `deliveryId=${payload.deliveryId}`];
      if (payload.linkRegistryId) parts.push(`linkRegistryId=${payload.linkRegistryId}`);
      if (ctaSlot) parts.push(`ctaSlot=${ctaSlot}`);
      parts.push(`error=${message}`);
      console.log(parts.join(' '));
    }
  }

  return { url: linkEntry.url };
}

module.exports = {
  recordClickAndRedirect
};
