'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { validateWarnLinkBlock } = require('../../domain/validators');

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

  return { url: linkEntry.url };
}

module.exports = {
  recordClickAndRedirect
};
