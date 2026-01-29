'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');

async function markInboxRead(payload) {
  const lineUserId = payload && payload.lineUserId;
  const deliveryId = payload && payload.deliveryId;
  if (!lineUserId) throw new Error('lineUserId required');
  if (!deliveryId) throw new Error('deliveryId required');
  const delivery = await deliveriesRepo.getDelivery(deliveryId);
  if (!delivery) throw new Error('delivery not found');
  if (delivery.lineUserId && delivery.lineUserId !== lineUserId) {
    throw new Error('delivery not found');
  }
  if (delivery.readAt) {
    return { id: deliveryId, readAt: delivery.readAt };
  }
  await deliveriesRepo.markRead(deliveryId);
  return { id: deliveryId };
}

module.exports = {
  markInboxRead
};
