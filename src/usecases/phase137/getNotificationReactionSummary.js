'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function computeLastReactionAt(deliveries) {
  let latest = null;
  let latestMs = null;
  for (const delivery of deliveries) {
    const clickMs = toMillis(delivery && delivery.clickAt);
    if (clickMs && (!latestMs || clickMs > latestMs)) {
      latestMs = clickMs;
      latest = delivery.clickAt;
    }
    const readMs = toMillis(delivery && delivery.readAt);
    if (readMs && (!latestMs || readMs > latestMs)) {
      latestMs = readMs;
      latest = delivery.readAt;
    }
  }
  return latest ? formatTimestamp(latest) : null;
}

function computeCtr(clicked, sent) {
  if (!sent) return 0;
  return clicked / sent;
}

async function getNotificationReactionSummary(params, deps) {
  const payload = params || {};
  const notificationId = requireString(payload.notificationId, 'notificationId');
  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const deliveries = await repo.listDeliveriesByNotificationId(notificationId);

  let sent = 0;
  let clicked = 0;
  let read = 0;
  for (const delivery of deliveries) {
    sent += 1;
    if (delivery && delivery.clickAt) clicked += 1;
    if (delivery && delivery.readAt) read += 1;
  }

  const lastReactionAt = computeLastReactionAt(deliveries);
  const ctr = computeCtr(clicked, sent);

  return {
    notificationId,
    sent,
    clicked,
    read,
    ctr,
    lastReactionAt
  };
}

module.exports = {
  getNotificationReactionSummary
};

