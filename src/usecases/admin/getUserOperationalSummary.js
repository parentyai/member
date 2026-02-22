'use strict';

const {
  listAllEvents,
  listEventsByCreatedAtRange,
  listAllChecklists,
  listAllUserChecklists,
  listAllNotificationDeliveries,
  listNotificationDeliveriesBySentAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed
} = require('../../domain/readModel/snapshotReadPolicy');
const DEFAULT_ANALYTICS_LIMIT = 1200;
const MAX_ANALYTICS_LIMIT = 2000;
const SNAPSHOT_TYPE = 'user_operational_summary';
const SNAPSHOT_KEY = 'latest';

function resolveAnalyticsLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_ANALYTICS_LIMIT;
  return Math.min(Math.floor(num), MAX_ANALYTICS_LIMIT);
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

function resolveAnalyticsQueryRangeFromUsers(users) {
  if (!Array.isArray(users) || users.length === 0) return { fromAt: null, toAt: null };
  let minCreatedAtMs = null;
  users.forEach((user) => {
    const data = user && user.data ? user.data : (user || {});
    const createdAtMs = toMillis(data.createdAt);
    if (!Number.isFinite(createdAtMs)) return;
    if (!Number.isFinite(minCreatedAtMs) || createdAtMs < minCreatedAtMs) {
      minCreatedAtMs = createdAtMs;
    }
  });
  if (!Number.isFinite(minCreatedAtMs)) return { fromAt: null, toAt: null };
  return {
    fromAt: new Date(minCreatedAtMs),
    toAt: new Date()
  };
}

function buildChecklistTotals(checklists) {
  const totals = new Map();
  for (const checklist of checklists) {
    const data = checklist.data || {};
    const scenario = data.scenario;
    const step = data.step;
    if (!scenario || !step) continue;
    const items = Array.isArray(data.items) ? data.items : [];
    const key = `${scenario}__${step}`;
    const current = totals.get(key) || 0;
    totals.set(key, current + items.length);
  }
  return totals;
}

function buildCompletedByUser(userChecklists) {
  const completed = new Map();
  for (const record of userChecklists) {
    const data = record.data || {};
    if (!data.lineUserId) continue;
    if (!data.completedAt) continue;
    const current = completed.get(data.lineUserId) || 0;
    completed.set(data.lineUserId, current + 1);
  }
  return completed;
}

function buildLatestActionByUser(events) {
  const latest = new Map();
  for (const event of events) {
    const data = event.data || {};
    const lineUserId = data.lineUserId;
    if (!lineUserId) continue;
    const ms = toMillis(data.createdAt);
    if (!ms) continue;
    const current = latest.get(lineUserId);
    if (!current || ms > current.ms) {
      latest.set(lineUserId, { ms, value: data.createdAt });
    }
  }
  return latest;
}

function buildLatestReactionByUser(deliveries) {
  const latestClick = new Map();
  const latestRead = new Map();
  for (const delivery of deliveries) {
    const data = delivery.data || {};
    const lineUserId = data.lineUserId;
    if (!lineUserId) continue;
    const clickMs = toMillis(data.clickAt);
    if (clickMs) {
      const current = latestClick.get(lineUserId);
      if (!current || clickMs > current.ms) {
        latestClick.set(lineUserId, { ms: clickMs, value: data.clickAt });
      }
    }
    const readMs = toMillis(data.readAt);
    if (readMs) {
      const current = latestRead.get(lineUserId);
      if (!current || readMs > current.ms) {
        latestRead.set(lineUserId, { ms: readMs, value: data.readAt });
      }
    }
  }
  return { latestClick, latestRead };
}

async function getUserOperationalSummary(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const snapshotMode = resolveSnapshotReadMode({ useSnapshot: opts.useSnapshot, snapshotMode: opts.snapshotMode });
  if (isSnapshotReadEnabled(snapshotMode)) {
    const snapshot = await opsSnapshotsRepo.getSnapshot(SNAPSHOT_TYPE, SNAPSHOT_KEY);
    if (snapshot && snapshot.data && Array.isArray(snapshot.data.items)) {
      return snapshot.data.items;
    }
    if (isSnapshotRequired(snapshotMode)) {
      return [];
    }
  }
  if (!isFallbackAllowed(snapshotMode)) {
    return [];
  }
  const analyticsLimit = resolveAnalyticsLimit(opts.analyticsLimit);
  const users = await usersRepo.listUsers({ limit: analyticsLimit });
  const queryRange = resolveAnalyticsQueryRangeFromUsers(users);
  let eventsPromise = Promise.resolve([]);
  let deliveriesPromise = Promise.resolve([]);
  if (queryRange.fromAt) {
    eventsPromise = listEventsByCreatedAtRange({
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    });
    deliveriesPromise = listNotificationDeliveriesBySentAtRange({
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    });
  }
  let [events, checklists, userChecklists, deliveries] = await Promise.all([
    eventsPromise,
    listAllChecklists({ limit: analyticsLimit }),
    listAllUserChecklists({ limit: analyticsLimit }),
    deliveriesPromise
  ]);

  if (events.length === 0) {
    events = await listAllEvents({ limit: analyticsLimit });
  }
  if (deliveries.length === 0) {
    deliveries = await listAllNotificationDeliveries({ limit: analyticsLimit });
  }
  const totals = buildChecklistTotals(checklists);
  const completedByUser = buildCompletedByUser(userChecklists);
  const latestActionByUser = buildLatestActionByUser(events);
  const latestReactionByUser = buildLatestReactionByUser(deliveries);

  return users.map((user) => {
    const data = user && user.data ? user.data : (user || {});
    const createdAtMs = toMillis(data.createdAt);
    const scenarioKey = data.scenarioKey;
    const stepKey = data.stepKey;
    const key = scenarioKey && stepKey ? `${scenarioKey}__${stepKey}` : null;
    const total = key ? (totals.get(key) || 0) : 0;
    const hasChecklistDone = data.checklistDone && typeof data.checklistDone === 'object';
    const completed = hasChecklistDone ? Object.keys(data.checklistDone).length : (completedByUser.get(user.id) || 0);
    const latest = latestActionByUser.get(user.id);
    const latestClick = latestReactionByUser.latestClick.get(user.id);
    const latestRead = latestReactionByUser.latestRead.get(user.id);
    const lastReactionAt = latestClick
      ? formatTimestamp(latestClick.value)
      : (latestRead ? formatTimestamp(latestRead.value) : null);
    return {
      lineUserId: user.id,
      createdAt: formatTimestamp(data.createdAt),
      createdAtMs,
      opsReviewLastReviewedAt: formatTimestamp(data.opsReviewLastReviewedAt),
      opsReviewLastReviewedBy: data.opsReviewLastReviewedBy || null,
      hasMemberNumber: Boolean(data.memberNumber && String(data.memberNumber).trim().length > 0),
      checklistCompleted: completed,
      checklistTotal: total,
      lastActionAt: latest ? formatTimestamp(latest.value) : null,
      lastReactionAt
    };
  });
}

module.exports = {
  getUserOperationalSummary
};
