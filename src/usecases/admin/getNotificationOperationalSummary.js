'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const {
  listAllEvents,
  listEventsByCreatedAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const DEFAULT_EVENTS_LIMIT = 1200;
const MAX_EVENTS_LIMIT = 3000;

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

async function getNotificationOperationalSummary(params) {
  const opts = params || {};
  const eventsLimit = resolveEventsLimit(opts.eventsLimit);
  const notifications = await notificationsRepo.listNotifications({
    limit: opts.limit,
    status: opts.status,
    scenarioKey: opts.scenarioKey,
    stepKey: opts.stepKey
  });
  const eventRange = resolveNotificationEventRange(notifications);
  let events;
  if (eventRange) {
    events = await listEventsByCreatedAtRange({
      limit: eventsLimit,
      fromAt: eventRange.fromAt,
      toAt: eventRange.toAt
    });
    if (!events.length) {
      events = await listAllEvents({ limit: eventsLimit });
    }
  } else {
    events = await listAllEvents({ limit: eventsLimit });
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

  return notifications.map((notification) => {
    const current = counts.get(notification.id) || { open: 0, click: 0, lastValue: null };
    return {
      notificationId: notification.id,
      title: notification.title || null,
      sentAt: notification.sentAt || null,
      openCount: current.open,
      clickCount: current.click,
      lastReactionAt: current.lastValue ? formatTimestamp(current.lastValue) : null
    };
  });
}

module.exports = {
  getNotificationOperationalSummary
};
