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
      await recordClick({
        notificationId: delivery.notificationId,
        ctaText: notification ? notification.ctaText || null : null,
        linkRegistryId: payload.linkRegistryId || null
      });
    }
  } catch (err) {
    // WIP: Phase18 CTA stats should not block click tracking
  }

  return { url: linkEntry.url };
}

module.exports = {
  recordClickAndRedirect
};
