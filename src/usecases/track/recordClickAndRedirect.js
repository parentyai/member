'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { validateWarnLinkBlock } = require('../../domain/validators');
const { recordClick } = require('../phase18/recordCtaStats');

async function recordClickAndRedirect(params) {
  const payload = params || {};
  if (!payload.deliveryId) throw new Error('deliveryId required');
  if (!payload.linkRegistryId) throw new Error('linkRegistryId required');

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
      const wrote = await recordClick({
        notificationId: delivery.notificationId,
        ctaText: notification ? notification.ctaText || null : null,
        linkRegistryId: payload.linkRegistryId || null
      });
      if (process.env.SERVICE_MODE === 'track') {
        const parts = ['[OBS] action=click-write', `result=${wrote ? 'ok' : 'skip'}`, `deliveryId=${payload.deliveryId}`];
        if (notification && notification.ctaText) parts.push(`ctaText=${notification.ctaText}`);
        if (payload.linkRegistryId) parts.push(`linkRegistryId=${payload.linkRegistryId}`);
        console.log(parts.join(' '));
      }
    }
  } catch (err) {
    // CTA stats failure must not block click tracking — best-effort only.
    if (process.env.SERVICE_MODE === 'track') {
      const message = err && err.message ? err.message : 'error';
      const parts = ['[OBS] action=click-write', 'result=error', `deliveryId=${payload.deliveryId}`];
      if (payload.linkRegistryId) parts.push(`linkRegistryId=${payload.linkRegistryId}`);
      parts.push(`error=${message}`);
      console.log(parts.join(' '));
    }
  }

  return { url: linkEntry.url };
}

module.exports = {
  recordClickAndRedirect
};
