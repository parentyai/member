'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const cityPackMetricsDailyRepo = require('../../repos/firestore/cityPackMetricsDailyRepo');
const {
  listAllNotificationDeliveries,
  listNotificationDeliveriesBySentAtRange
} = require('../../repos/firestore/analyticsReadRepo');

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

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function resolvePositiveIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const value = Math.floor(num);
  if (Number.isFinite(min) && value < min) return min;
  if (Number.isFinite(max) && value > max) return max;
  return value;
}

function isCityPackMetricsBoundedEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CITY_PACK_METRICS_BOUNDED_V1', true);
}

function isCityPackMetricsDailyPreferredEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1', true);
}

function resolveMetricsDeliveryLimitMax() {
  return resolvePositiveIntEnv('CITY_PACK_METRICS_DELIVERY_LIMIT_MAX', 2000, 50, 5000);
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

function normalizeDeliveryReadLimit(limit, windowDays) {
  const limitMax = resolveMetricsDeliveryLimitMax();
  const estimate = Math.max(limit, limit * windowDays * 10);
  return Math.min(limitMax, estimate);
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

function normalizeCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeDailyRows(rows, traceId) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const sentCount = normalizeCount(row && row.sentCount);
    const deliveredCount = normalizeCount(row && row.deliveredCount);
    const clickCount = normalizeCount(row && row.clickCount);
    const readCount = normalizeCount(row && row.readCount);
    const failedCount = normalizeCount(row && row.failedCount);
    const ctr = deliveredCount > 0 ? Math.round((clickCount / deliveredCount) * 10000) / 10000 : 0;
    return {
      dateKey: row && row.dateKey ? String(row.dateKey) : null,
      cityPackId: row && row.cityPackId ? String(row.cityPackId) : 'unmapped',
      slotId: row && row.slotId ? String(row.slotId) : 'default',
      sourceRefId: row && row.sourceRefId ? String(row.sourceRefId) : 'none',
      sentCount,
      deliveredCount,
      clickCount,
      readCount,
      failedCount,
      ctr,
      traceId: row && row.traceId ? row.traceId : traceId
    };
  }).filter((row) => row.dateKey);
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

function aggregateScopeRows(dailyRows, limit) {
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
  return Array.from(aggregateByScope.values())
    .map((row) => Object.assign({}, row, {
      ctr: row.deliveredCount > 0 ? Math.round((row.clickCount / row.deliveredCount) * 10000) / 10000 : 0
    }))
    .sort((a, b) => {
      if (b.sentCount !== a.sentCount) return b.sentCount - a.sentCount;
      if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
      return String(a.cityPackId).localeCompare(String(b.cityPackId));
    })
    .slice(0, limit);
}

async function buildDailyRowsFromDeliveries(params) {
  const input = params && typeof params === 'object' ? params : {};
  const deliveries = Array.isArray(input.deliveries) ? input.deliveries : [];
  const sinceMs = Number(input.sinceMs) || 0;
  const resolveNotifications = input.resolveNotifications;
  const resolveSourceRef = input.resolveSourceRef;
  const traceId = input.traceId || null;
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

  return normalizeDailyRows(Array.from(dailyBucket.values()), traceId);
}

async function computeCityPackMetrics(payload, deps) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const resolveNotifications = deps && deps.getNotification ? deps.getNotification : notificationsRepo.getNotification;
  const resolveSourceRef = deps && deps.getSourceRef ? deps.getSourceRef : sourceRefsRepo.getSourceRef;
  const fetchAllDeliveries = deps && deps.listAllNotificationDeliveries
    ? deps.listAllNotificationDeliveries
    : listAllNotificationDeliveries;
  const fetchDeliveriesBySentAtRange = deps && deps.listNotificationDeliveriesBySentAtRange
    ? deps.listNotificationDeliveriesBySentAtRange
    : listNotificationDeliveriesBySentAtRange;
  const listMetricRows = deps && deps.listMetricRows
    ? deps.listMetricRows
    : cityPackMetricsDailyRepo.listMetricRows;

  const nowMs = toMillis(input.now) || Date.now();
  const windowDays = normalizeWindowDays(input.windowDays);
  const limit = normalizeLimit(input.limit);
  const sinceMs = nowMs - (windowDays * 24 * 60 * 60 * 1000);
  const sinceDateKey = toDateKey(sinceMs);
  const nowDateKey = toDateKey(nowMs);
  const traceId = typeof input.traceId === 'string' && input.traceId.trim() ? input.traceId.trim() : null;

  const boundedEnabled = isCityPackMetricsBoundedEnabled();
  const dailyPreferredEnabled = isCityPackMetricsDailyPreferredEnabled();
  const readLimitUsed = boundedEnabled ? normalizeDeliveryReadLimit(limit, windowDays) : null;
  let dataSource = 'notification_deliveries_all_legacy';
  let dailyRows = [];

  if (dailyPreferredEnabled) {
    try {
      const persistedRows = await listMetricRows({
        dateFrom: sinceDateKey,
        dateTo: nowDateKey,
        limit: Math.min(readLimitUsed || (limit * windowDays), 1000)
      });
      const normalizedRows = normalizeDailyRows(persistedRows, traceId).filter((row) => {
        const rowMs = toMillis(row.dateKey);
        return rowMs >= sinceMs && rowMs <= nowMs;
      });
      if (normalizedRows.length) {
        dailyRows = normalizedRows;
        dataSource = 'city_pack_metrics_daily';
      }
    } catch (_err) {
      // fallback to deliveries path
    }
  }

  if (!dailyRows.length) {
    let deliveries = [];
    if (boundedEnabled) {
      const fallbackToAllDeliveries = async () => {
        deliveries = await fetchAllDeliveries({ limit: readLimitUsed });
        dataSource = 'notification_deliveries_all_fallback';
      };
      try {
        deliveries = await fetchDeliveriesBySentAtRange({
          fromAt: new Date(sinceMs).toISOString(),
          toAt: new Date(nowMs).toISOString(),
          limit: readLimitUsed
        });
        dataSource = 'notification_deliveries_sentAt_range';
        if (!deliveries.length) {
          await fallbackToAllDeliveries();
        }
      } catch (_err) {
        await fallbackToAllDeliveries();
      }
    } else {
      deliveries = await fetchAllDeliveries();
      dataSource = 'notification_deliveries_all_legacy';
    }
    dailyRows = await buildDailyRowsFromDeliveries({
      deliveries,
      sinceMs,
      resolveNotifications,
      resolveSourceRef,
      traceId
    });
  }

  return {
    ok: true,
    traceId,
    windowDays,
    sinceDateKey,
    dailyRows,
    summary: buildWindowSummary(dailyRows),
    items: aggregateScopeRows(dailyRows, limit),
    dataSource,
    readLimitUsed
  };
}

module.exports = {
  computeCityPackMetrics,
  normalizeWindowDays,
  normalizeLimit
};
