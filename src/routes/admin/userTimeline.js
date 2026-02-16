'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { buildTemplateKey } = require('../../usecases/adminOs/planNotificationSend');
const { mapFailureCode } = require('../../domain/notificationFailureTaxonomy');

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

function resolveDeliveredAt(record) {
  if (!record) return null;
  return record.deliveredAt || record.sentAt || null;
}

async function handleUserTimeline(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (!lineUserId || !String(lineUserId).trim()) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  const limit = normalizeLimit(url.searchParams.get('limit'), 50, 200);
  try {
    const [deliveries, timeline, events] = await Promise.all([
      deliveriesRepo.listDeliveriesByUser(lineUserId, limit),
      decisionTimelineRepo.listTimelineEntries(lineUserId, limit),
      eventsRepo.listEventsByUser(lineUserId, limit)
    ]);

    const traceByNotification = new Map();
    const traceIds = [];
    for (const entry of timeline) {
      if (entry && entry.traceId && !traceIds.includes(entry.traceId)) {
        traceIds.push(entry.traceId);
      }
      if (entry && entry.notificationId && entry.traceId && !traceByNotification.has(entry.notificationId)) {
        traceByNotification.set(entry.notificationId, entry.traceId);
      }
    }

    const audits = [];
    for (const traceId of traceIds.slice(0, 20)) {
      const items = await auditLogsRepo.listAuditLogsByTraceId(traceId, limit);
      audits.push({ traceId, items });
    }

    const notificationCache = new Map();
    async function resolveNotification(id) {
      if (!id) return null;
      if (notificationCache.has(id)) return notificationCache.get(id);
      const record = await notificationsRepo.getNotification(id);
      notificationCache.set(id, record || null);
      return record || null;
    }

    const enrichedDeliveries = [];
    for (const delivery of deliveries) {
      const notificationId = delivery.notificationId || null;
      const notification = await resolveNotification(notificationId);
      const traceId = notificationId ? traceByNotification.get(notificationId) || null : null;
      const status = delivery.state || (delivery.delivered ? 'delivered' : 'unknown');
      const failureCode = delivery.lastError ? mapFailureCode({ message: delivery.lastError }) : null;
      enrichedDeliveries.push({
        deliveryId: delivery.id,
        notificationId,
        sentAt: delivery.sentAt || null,
        deliveredAt: resolveDeliveredAt(delivery),
        delivered: Boolean(delivery.delivered),
        status,
        failureCode,
        lastError: delivery.lastError || null,
        notificationCategory: delivery.notificationCategory || null,
        scenarioKey: notification ? notification.scenarioKey || null : null,
        stepKey: notification ? notification.stepKey || null : null,
        templateKey: notificationId ? buildTemplateKey(notificationId) : null,
        traceId
      });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      lineUserId: String(lineUserId),
      deliveries: enrichedDeliveries,
      timeline,
      events,
      audits,
      traceIds,
      serverTime: new Date().toISOString()
    }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

module.exports = {
  handleUserTimeline
};
