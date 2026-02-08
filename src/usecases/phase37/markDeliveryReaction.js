'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

const ACTIONS = new Set(['read', 'click']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function requireAction(action) {
  if (!ACTIONS.has(action)) throw new Error('invalid action');
  return action;
}

async function markDeliveryReaction(params, deps) {
  const payload = params || {};
  const deliveryId = requireString(payload.deliveryId, 'deliveryId');
  const action = requireAction(payload.action);

  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;

  if (action === 'read') {
    await deliveries.markRead(deliveryId);
    await auditRepo.appendAuditLog({
      action: 'DELIVERY_READ',
      eventType: 'DELIVERY_READ',
      type: 'DELIVERY_READ',
      deliveryId
    });
  } else {
    await deliveries.markClick(deliveryId);
    await auditRepo.appendAuditLog({
      action: 'DELIVERY_CLICK',
      eventType: 'DELIVERY_CLICK',
      type: 'DELIVERY_CLICK',
      deliveryId
    });
  }

  return { ok: true, deliveryId, action };
}

module.exports = {
  markDeliveryReaction
};
