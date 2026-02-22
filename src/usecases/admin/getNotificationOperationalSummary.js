'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const {
  listEventsByCreatedAtRange,
  listEventsByNotificationIdsAndCreatedAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed,
  resolveSnapshotFreshnessMinutes,
  isSnapshotFresh
} = require('../../domain/readModel/snapshotReadPolicy');
const DEFAULT_EVENTS_LIMIT = 1200;
const MAX_EVENTS_LIMIT = 3000;
const SNAPSHOT_TYPE = 'notification_operational_summary';
const SNAPSHOT_KEY = 'latest';
const FALLBACK_MODE_ALLOW = 'allow';
const FALLBACK_MODE_BLOCK = 'block';

function resolveEventsLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_EVENTS_LIMIT;
  return Math.min(Math.floor(num), MAX_EVENTS_LIMIT);
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
  return value;
}

function resolveNotificationEventRange(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return null;
  let minMs = null;
  for (const notification of notifications) {
    const sentMs = toMillis(notification && notification.sentAt);
    const createdMs = toMillis(notification && notification.createdAt);
    const candidate = Number.isFinite(sentMs) ? sentMs : createdMs;
    if (!Number.isFinite(candidate)) continue;
    if (minMs === null || candidate < minMs) minMs = candidate;
  }
  if (!Number.isFinite(minMs)) return null;
  return {
    fromAt: new Date(minMs),
    toAt: new Date()
  };
}

function resolveNotificationFilters(options) {
  return {
    status: typeof options.status === 'string' && options.status.trim() ? options.status.trim() : undefined,
    scenarioKey: typeof options.scenarioKey === 'string' && options.scenarioKey.trim() ? options.scenarioKey.trim() : undefined,
    stepKey: typeof options.stepKey === 'string' && options.stepKey.trim() ? options.stepKey.trim() : undefined
  };
}

function resolveFallbackMode(value) {
  if (value === FALLBACK_MODE_BLOCK) return FALLBACK_MODE_BLOCK;
  return FALLBACK_MODE_ALLOW;
}

function createSummaryItem(notification, current) {
  return {
    notificationId: notification.id,
    title: notification.title || null,
    sentAt: notification.sentAt || null,
    openCount: current.open,
    clickCount: current.click,
    lastReactionAt: current.lastValue ? formatTimestamp(current.lastValue) : null
  };
}

function collectNotificationIds(notifications) {
  return Array.from(new Set((notifications || []).map((notification) => {
    const id = notification && notification.id ? String(notification.id).trim() : '';
    return id;
  }).filter(Boolean)));
}

async function safeQuery(queryFn) {
  try {
    const rows = await queryFn();
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch (_err) {
    return { rows: [], failed: true };
  }
}

async function buildFromSnapshot(snapshotItems, options) {
  const opts = options || {};
  const filters = resolveNotificationFilters(opts);
  const hasScopedFilter = Boolean(filters.status || filters.scenarioKey || filters.stepKey);
  const limit = Number.isFinite(Number(opts.limit)) && Number(opts.limit) > 0 ? Math.floor(Number(opts.limit)) : null;
  if (!hasScopedFilter) {
    const sorted = Array.isArray(snapshotItems) ? snapshotItems : [];
    return limit ? sorted.slice(0, limit) : sorted;
  }
  const notifications = await notificationsRepo.listNotifications({
    limit,
    status: filters.status,
    scenarioKey: filters.scenarioKey,
    stepKey: filters.stepKey
  });
  const byId = new Map((Array.isArray(snapshotItems) ? snapshotItems : []).map((row) => [row.notificationId, row]));
  return notifications.map((notification) => {
    const current = byId.get(notification.id) || { openCount: 0, clickCount: 0, lastReactionAt: null };
    return {
      notificationId: notification.id,
      title: notification.title || null,
      sentAt: notification.sentAt || null,
      openCount: Number(current.openCount) || 0,
      clickCount: Number(current.clickCount) || 0,
      lastReactionAt: current.lastReactionAt || null
    };
  });
}

async function getNotificationOperationalSummary(params) {
  const opts = params || {};
  const fallbackMode = resolveFallbackMode(opts.fallbackMode);
  const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;
  const fallbackOnEmpty = opts.fallbackOnEmpty !== false;
  const includeMeta = opts.includeMeta === true;
  const freshnessMinutes = resolveSnapshotFreshnessMinutes(opts);
  const fallbackSources = [];
  const addFallbackSource = (sourceName) => {
    if (!sourceName || fallbackSources.includes(sourceName)) return;
    fallbackSources.push(sourceName);
  };
  const withMeta = (items, meta) => {
    if (!includeMeta) return items;
    return { items, meta };
  };
  const snapshotMode = resolveSnapshotReadMode({ useSnapshot: opts.useSnapshot, snapshotMode: opts.snapshotMode });
  if (isSnapshotReadEnabled(snapshotMode)) {
    const snapshot = await opsSnapshotsRepo.getSnapshot(SNAPSHOT_TYPE, SNAPSHOT_KEY);
    if (snapshot && snapshot.data && Array.isArray(snapshot.data.items) && isSnapshotFresh(snapshot, freshnessMinutes)) {
      const items = await buildFromSnapshot(snapshot.data.items, opts);
      return withMeta(items, {
        dataSource: 'snapshot',
        asOf: snapshot.asOf || null,
        freshnessMinutes: Number.isFinite(Number(snapshot.freshnessMinutes))
          ? Number(snapshot.freshnessMinutes)
          : freshnessMinutes,
        fallbackUsed: false,
        fallbackBlocked: false,
        fallbackSources: []
      });
    }
    if (isSnapshotRequired(snapshotMode)) {
      return withMeta([], {
        dataSource: 'not_available',
        asOf: null,
        freshnessMinutes,
        fallbackUsed: false,
        fallbackBlocked: true,
        fallbackSources: []
      });
    }
  }
  if (!isFallbackAllowed(snapshotMode)) {
    return withMeta([], {
      dataSource: 'not_available',
      asOf: null,
      freshnessMinutes,
      fallbackUsed: false,
      fallbackBlocked: true,
      fallbackSources: []
    });
  }

  const eventsLimit = resolveEventsLimit(opts.eventsLimit);
  const filters = resolveNotificationFilters(opts);
  const notifications = await notificationsRepo.listNotifications({
    limit: opts.limit,
    status: filters.status,
    scenarioKey: filters.scenarioKey,
    stepKey: filters.stepKey
  });
  const eventRange = resolveNotificationEventRange(notifications);
  const notificationIds = collectNotificationIds(notifications);
  let events;
  let fallbackBlockedNotAvailable = false;
  if (eventRange) {
    const scoped = await safeQuery(() => listEventsByNotificationIdsAndCreatedAtRange({
      notificationIds,
      limit: eventsLimit,
      fromAt: eventRange.fromAt,
      toAt: eventRange.toAt
    }));
    events = scoped.rows;
    let rangeFailed = false;
    if (!events.length) {
      try {
        events = await listEventsByCreatedAtRange({
          limit: eventsLimit,
          fromAt: eventRange.fromAt,
          toAt: eventRange.toAt
        });
      } catch (_err) {
        rangeFailed = true;
        events = [];
      }
    }
    if (!events.length && scoped.failed) {
      const range = await safeQuery(() => listEventsByCreatedAtRange({
        limit: eventsLimit,
        fromAt: eventRange.fromAt,
        toAt: eventRange.toAt
      }));
      rangeFailed = range.failed;
      if (range.rows.length > 0) {
        events = range.rows;
      }
    }
    if (!events.length && (scoped.failed || rangeFailed)) {
      // keep failure-only branch explicit for fallback diagnostics contract
    }
    if (!events.length && !fallbackBlocked) {
      if (fallbackOnEmpty || scoped.failed || rangeFailed) {
        events = await listEventsByCreatedAtRange({ limit: eventsLimit });
        addFallbackSource('listEventsByCreatedAtRange:fallback');
      }
    }
    if (!events.length && (scoped.failed || rangeFailed) && fallbackBlocked) {
      fallbackBlockedNotAvailable = true;
    }
  } else {
    events = [];
  }

  const counts = new Map();
  for (const event of events) {
    const data = event.data || {};
    const ref = data.ref || {};
    const notificationId = ref.notificationId;
    if (!notificationId) continue;
    if (data.type !== 'open' && data.type !== 'click') continue;
    const current = counts.get(notificationId) || { open: 0, click: 0, lastMs: null, lastValue: null };
    current[data.type] += 1;
    const ms = toMillis(data.createdAt);
    if (ms && (!current.lastMs || ms > current.lastMs)) {
      current.lastMs = ms;
      current.lastValue = data.createdAt;
    }
    counts.set(notificationId, current);
  }

  const items = notifications.map((notification) => {
    const current = counts.get(notification.id) || { open: 0, click: 0, lastValue: null };
    return createSummaryItem(notification, current);
  });
  const computedAsOf = new Date().toISOString();
  return withMeta(items, {
    dataSource: fallbackBlockedNotAvailable ? 'not_available' : 'computed',
    asOf: fallbackBlockedNotAvailable ? null : computedAsOf,
    freshnessMinutes: null,
    note: fallbackBlockedNotAvailable ? 'NOT AVAILABLE' : null,
    fallbackUsed: fallbackSources.length > 0,
    fallbackBlocked: fallbackBlockedNotAvailable,
    fallbackSources
  });
}

module.exports = {
  getNotificationOperationalSummary
};
