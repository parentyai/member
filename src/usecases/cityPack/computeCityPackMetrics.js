'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const { listAllNotificationDeliveries } = require('../../repos/firestore/phase2ReadRepo');

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeWindowDays(value) {
  const num = Number(value);
  if (num === 30) return 30;
  return 7;
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.max(Math.floor(num), 1), 200);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const item = typeof value === 'string' ? value.trim() : '';
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function resolveDeliveryTimestamp(delivery) {
  return toMillis(delivery && (delivery.deliveredAt || delivery.sentAt || delivery.createdAt));
}

function isDelivered(delivery) {
  if (!delivery || typeof delivery !== 'object') return false;
  if (delivery.delivered === true) return true;
  const state = typeof delivery.state === 'string' ? delivery.state.trim().toLowerCase() : '';
  if (state === 'delivered' || state === 'sealed') return true;
  return Boolean(delivery.deliveredAt);
}

function isClicked(delivery) {
  return Boolean(delivery && delivery.clickAt);
}

function isRead(delivery) {
  return Boolean(delivery && delivery.readAt);
}

function isFailed(delivery) {
  if (!delivery || typeof delivery !== 'object') return false;
  const state = typeof delivery.state === 'string' ? delivery.state.trim().toLowerCase() : '';
  return state === 'failed' || Boolean(delivery.lastError);
}

function resolveSlotId(notification) {
  const meta = notification && notification.notificationMeta && typeof notification.notificationMeta === 'object'
    ? notification.notificationMeta
    : null;
  const candidate = meta && typeof meta.slotId === 'string' && meta.slotId.trim()
    ? meta.slotId.trim()
    : meta && typeof meta.slotKey === 'string' && meta.slotKey.trim()
      ? meta.slotKey.trim()
      : meta && typeof meta.slot === 'string' && meta.slot.trim()
        ? meta.slot.trim()
        : 'default';
  return candidate;
}

function buildWindowSummary(rows) {
  const summary = {
    totalRows: rows.length,
    totalSent: 0,
    totalDelivered: 0,
    totalClicked: 0,
    totalRead: 0,
    totalFailed: 0
  };
  rows.forEach((row) => {
    summary.totalSent += Number(row.sentCount) || 0;
    summary.totalDelivered += Number(row.deliveredCount) || 0;
    summary.totalClicked += Number(row.clickCount) || 0;
    summary.totalRead += Number(row.readCount) || 0;
    summary.totalFailed += Number(row.failedCount) || 0;
  });
  summary.windowCtr = summary.totalDelivered > 0
    ? Math.round((summary.totalClicked / summary.totalDelivered) * 10000) / 10000
    : 0;
  return summary;
}

async function computeCityPackMetrics(payload, deps) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const resolveNotifications = deps && deps.getNotification ? deps.getNotification : notificationsRepo.getNotification;
  const resolveSourceRef = deps && deps.getSourceRef ? deps.getSourceRef : sourceRefsRepo.getSourceRef;
  const fetchDeliveries = deps && deps.listAllNotificationDeliveries
    ? deps.listAllNotificationDeliveries
    : listAllNotificationDeliveries;

  const nowMs = toMillis(input.now) || Date.now();
  const windowDays = normalizeWindowDays(input.windowDays);
  const limit = normalizeLimit(input.limit);
  const sinceMs = nowMs - (windowDays * 24 * 60 * 60 * 1000);
  const traceId = typeof input.traceId === 'string' && input.traceId.trim() ? input.traceId.trim() : null;

  const deliveries = await fetchDeliveries();
  const notificationCache = new Map();
  const sourceRefCache = new Map();
  const dailyBucket = new Map();

  for (const row of deliveries) {
    const delivery = row && row.data && typeof row.data === 'object' ? row.data : row;
    const timestampMs = resolveDeliveryTimestamp(delivery);
    if (!timestampMs || timestampMs < sinceMs) continue;
    const notificationId = typeof delivery.notificationId === 'string' ? delivery.notificationId.trim() : '';
    if (!notificationId) continue;

    if (!notificationCache.has(notificationId)) {
      notificationCache.set(notificationId, await resolveNotifications(notificationId));
    }
    const notification = notificationCache.get(notificationId);
    if (!notification) continue;

    const sourceRefIds = normalizeStringArray(notification.sourceRefs);
    if (!sourceRefIds.length) continue;
    const slotId = resolveSlotId(notification);
    const dateKey = toDateKey(timestampMs);
    const delivered = isDelivered(delivery);
    const clicked = isClicked(delivery);
    const read = isRead(delivery);
    const failed = isFailed(delivery);

    for (const sourceRefId of sourceRefIds) {
      if (!sourceRefCache.has(sourceRefId)) {
        sourceRefCache.set(sourceRefId, await resolveSourceRef(sourceRefId));
      }
      const sourceRef = sourceRefCache.get(sourceRefId);
      const cityPackIds = normalizeStringArray(sourceRef && sourceRef.usedByCityPackIds);
      const effectiveCityPackIds = cityPackIds.length ? cityPackIds : ['unmapped'];

      for (const cityPackId of effectiveCityPackIds) {
        const key = `${dateKey}::${cityPackId}::${slotId}::${sourceRefId}`;
        const current = dailyBucket.get(key) || {
          dateKey,
          cityPackId,
          slotId,
          sourceRefId,
          sentCount: 0,
          deliveredCount: 0,
          clickCount: 0,
          readCount: 0,
          failedCount: 0
        };
        current.sentCount += 1;
        if (delivered) current.deliveredCount += 1;
        if (clicked) current.clickCount += 1;
        if (read) current.readCount += 1;
        if (failed) current.failedCount += 1;
        dailyBucket.set(key, current);
      }
    }
  }

  const dailyRows = Array.from(dailyBucket.values()).map((row) => {
    const deliveredCount = Number(row.deliveredCount) || 0;
    const clickCount = Number(row.clickCount) || 0;
    return Object.assign({}, row, {
      ctr: deliveredCount > 0 ? Math.round((clickCount / deliveredCount) * 10000) / 10000 : 0,
      traceId
    });
  });

  const aggregateByScope = new Map();
  for (const row of dailyRows) {
    const key = `${row.cityPackId}::${row.slotId}::${row.sourceRefId}`;
    const current = aggregateByScope.get(key) || {
      cityPackId: row.cityPackId,
      slotId: row.slotId,
      sourceRefId: row.sourceRefId,
      sentCount: 0,
      deliveredCount: 0,
      clickCount: 0,
      readCount: 0,
      failedCount: 0,
      firstDateKey: row.dateKey,
      lastDateKey: row.dateKey
    };
    current.sentCount += Number(row.sentCount) || 0;
    current.deliveredCount += Number(row.deliveredCount) || 0;
    current.clickCount += Number(row.clickCount) || 0;
    current.readCount += Number(row.readCount) || 0;
    current.failedCount += Number(row.failedCount) || 0;
    if (row.dateKey < current.firstDateKey) current.firstDateKey = row.dateKey;
    if (row.dateKey > current.lastDateKey) current.lastDateKey = row.dateKey;
    aggregateByScope.set(key, current);
  }

  const items = Array.from(aggregateByScope.values())
    .map((row) => Object.assign({}, row, {
      ctr: row.deliveredCount > 0 ? Math.round((row.clickCount / row.deliveredCount) * 10000) / 10000 : 0
    }))
    .sort((a, b) => {
      if (b.sentCount !== a.sentCount) return b.sentCount - a.sentCount;
      if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
      return String(a.cityPackId).localeCompare(String(b.cityPackId));
    })
    .slice(0, limit);

  return {
    ok: true,
    traceId,
    windowDays,
    sinceDateKey: toDateKey(sinceMs),
    dailyRows,
    summary: buildWindowSummary(dailyRows),
    items
  };
}

module.exports = {
  computeCityPackMetrics,
  normalizeWindowDays,
  normalizeLimit
};

