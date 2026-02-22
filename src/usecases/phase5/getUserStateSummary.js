'use strict';

const {
  listAllEvents,
  listEventsByCreatedAtRange,
  listEventsByLineUserIdAndCreatedAtRange,
  listAllChecklists,
  listChecklistsByScenarioAndStep,
  listAllUserChecklists,
  listUserChecklistsByLineUserId,
  listAllNotificationDeliveries,
  listNotificationDeliveriesBySentAtRange,
  listNotificationDeliveriesByLineUserIdAndSentAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { getNotificationReadModel } = require('../admin/getNotificationReadModel');
const { evaluateChecklistCompleteness } = require('../phase24/checklistCompleteness');
const { evaluateUserSummaryCompleteness } = require('../phase24/userSummaryCompleteness');
const { evaluateRegistrationCompleteness } = require('../phase24/registrationCompleteness');
const { evaluateOpsStateCompleteness } = require('../phase24/opsStateCompleteness');
const { evaluateOpsDecisionCompleteness } = require('../phase24/opsDecisionCompleteness');
const { evaluateOverallDecisionReadiness } = require('../phase24/overallDecisionReadiness');
const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed,
  resolveSnapshotFreshnessMinutes,
  isSnapshotFresh
} = require('../../domain/readModel/snapshotReadPolicy');

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;
const DEFAULT_ANALYTICS_LIMIT = 1200;
const MAX_ANALYTICS_LIMIT = 2000;
const SNAPSHOT_TYPE = 'user_state_summary';
const FALLBACK_MODE_ALLOW = 'allow';
const FALLBACK_MODE_BLOCK = 'block';

function resolveAnalyticsLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_ANALYTICS_LIMIT;
  return Math.min(Math.floor(num), MAX_ANALYTICS_LIMIT);
}

function resolveFallbackMode(value) {
  if (value === FALLBACK_MODE_BLOCK) return FALLBACK_MODE_BLOCK;
  return FALLBACK_MODE_ALLOW;
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

function isMemberNumberStale(data, nowMs) {
  const memberNumber = data && data.memberNumber ? String(data.memberNumber).trim() : '';
  if (memberNumber.length > 0) return false;
  const createdAtMs = toMillis(data && data.createdAt);
  if (!createdAtMs) return false;
  return nowMs - createdAtMs >= STALE_DAYS * DAY_MS;
}

function countChecklistTotal(checklists, scenarioKey, stepKey) {
  if (!scenarioKey || !stepKey) return 0;
  let total = 0;
  for (const checklist of checklists) {
    const data = checklist.data || {};
    if (data.scenario !== scenarioKey || data.step !== stepKey) continue;
    const items = Array.isArray(data.items) ? data.items : [];
    total += items.length;
  }
  return total;
}

function countChecklistCompletedByUser(user, userChecklists) {
  if (user && user.checklistDone && typeof user.checklistDone === 'object') {
    return Object.keys(user.checklistDone).length;
  }
  let count = 0;
  for (const record of userChecklists) {
    const data = record.data || {};
    if (data.lineUserId !== user.id) continue;
    if (!data.completedAt) continue;
    count += 1;
  }
  return count;
}

function findLatestAction(events, lineUserId) {
  let latest = null;
  let latestMs = null;
  for (const event of events) {
    const data = event.data || {};
    if (data.lineUserId !== lineUserId) continue;
    const ms = toMillis(data.createdAt);
    if (!ms) continue;
    if (!latestMs || ms > latestMs) {
      latestMs = ms;
      latest = data.createdAt;
    }
  }
  return latest ? formatTimestamp(latest) : null;
}

function findLastReactionAt(deliveries, lineUserId) {
  let latestClick = null;
  let latestClickMs = null;
  let latestRead = null;
  let latestReadMs = null;
  for (const delivery of deliveries) {
    const data = delivery.data || {};
    if (data.lineUserId !== lineUserId) continue;
    const clickMs = toMillis(data.clickAt);
    if (clickMs && (!latestClickMs || clickMs > latestClickMs)) {
      latestClickMs = clickMs;
      latestClick = data.clickAt;
    }
    const readMs = toMillis(data.readAt);
    if (readMs && (!latestReadMs || readMs > latestReadMs)) {
      latestReadMs = readMs;
      latestRead = data.readAt;
    }
  }
  if (latestClick) return formatTimestamp(latestClick);
  if (latestRead) return formatTimestamp(latestRead);
  return null;
}

function resolveLatestNotificationId(deliveries, lineUserId) {
  let latestId = null;
  let latestMs = null;
  for (const delivery of deliveries) {
    const data = delivery.data || {};
    if (data.lineUserId !== lineUserId) continue;
    const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
    if (!notificationId) continue;
    const ms = toMillis(data.deliveredAt) || toMillis(data.sentAt);
    if (!ms) continue;
    if (!latestMs || ms > latestMs) {
      latestMs = ms;
      latestId = notificationId;
    }
  }
  return latestId;
}

function resolveAnalyticsQueryRangeFromUser(user) {
  const data = user && user.data ? user.data : (user || {});
  const createdAtMs = toMillis(data.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return { fromAt: null, toAt: null };
  }
  return {
    fromAt: new Date(createdAtMs),
    toAt: new Date()
  };
}

async function resolveNotificationSummaryCompleteness(deliveries, lineUserId) {
  const notificationId = resolveLatestNotificationId(deliveries, lineUserId);
  if (!notificationId) return null;
  const items = await getNotificationReadModel({ notificationId, limit: 1 });
  const item = Array.isArray(items) && items.length > 0 ? items[0] : null;
  return item && item.completeness ? item.completeness : null;
}

async function safeQuery(queryFn) {
  try {
    const rows = await queryFn();
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch (_err) {
    return { rows: [], failed: true };
  }
}

async function getUserStateSummary(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const fallbackMode = resolveFallbackMode(payload.fallbackMode);
  const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;
  const fallbackOnEmpty = payload.fallbackOnEmpty !== false;
  const includeMeta = payload.includeMeta === true;
  const freshnessMinutes = resolveSnapshotFreshnessMinutes(payload);
  const fallbackSources = [];
  const addFallbackSource = (sourceName) => {
    if (!sourceName || fallbackSources.includes(sourceName)) return;
    fallbackSources.push(sourceName);
  };
  const withMeta = (item, meta) => {
    if (!includeMeta) return item;
    return { item, meta };
  };
  const snapshotMode = resolveSnapshotReadMode({ useSnapshot: payload.useSnapshot, snapshotMode: payload.snapshotMode });
  if (isSnapshotReadEnabled(snapshotMode)) {
    const snapshot = await opsSnapshotsRepo.getSnapshot(SNAPSHOT_TYPE, payload.lineUserId);
    if (snapshot && snapshot.data && typeof snapshot.data === 'object' && isSnapshotFresh(snapshot, freshnessMinutes)) {
      return withMeta(snapshot.data, {
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
      return withMeta({
        lineUserId: payload.lineUserId,
        notAvailable: true,
        notAvailableReason: 'snapshot_required_not_available'
      }, {
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
    return withMeta({
      lineUserId: payload.lineUserId,
      notAvailable: true,
      notAvailableReason: 'snapshot_fallback_disabled'
    }, {
      dataSource: 'not_available',
      asOf: null,
      freshnessMinutes,
      fallbackUsed: false,
      fallbackBlocked: true,
      fallbackSources: []
    });
  }
  const analyticsLimit = resolveAnalyticsLimit(payload.analyticsLimit);
  const user = await usersRepo.getUser(payload.lineUserId);
  if (!user) throw new Error('user not found');
  const data = user.data || user || {};
  const queryRange = resolveAnalyticsQueryRangeFromUser(user);
  let eventsPromise = Promise.resolve({ rows: [], failed: false });
  let deliveriesPromise = Promise.resolve({ rows: [], failed: false });
  if (queryRange.fromAt) {
    eventsPromise = safeQuery(() => listEventsByLineUserIdAndCreatedAtRange({
      lineUserId: payload.lineUserId,
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }));
    deliveriesPromise = safeQuery(() => listNotificationDeliveriesByLineUserIdAndSentAtRange({
      lineUserId: payload.lineUserId,
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }));
  }
  const checklistsPromise = safeQuery(() => listChecklistsByScenarioAndStep({
    scenario: data.scenarioKey,
    step: data.stepKey,
    limit: analyticsLimit
  }));
  const userChecklistsPromise = safeQuery(() => listUserChecklistsByLineUserId({
    lineUserId: payload.lineUserId,
    limit: analyticsLimit
  }));

  let [eventsResult, checklistsResult, userChecklistsResult, deliveriesResult] = await Promise.all([
    eventsPromise,
    checklistsPromise,
    userChecklistsPromise,
    deliveriesPromise
  ]);
  let checklists = checklistsResult.rows;
  let events = eventsResult.rows;
  let userChecklists = userChecklistsResult.rows;
  let deliveries = deliveriesResult.rows;
  let rangeEventsFailed = false;
  let rangeDeliveriesFailed = false;
  let fallbackBlockedNotAvailable = false;

  if (events.length === 0) {
    if (queryRange.fromAt) {
      const rangeEventsResult = await safeQuery(() => listEventsByCreatedAtRange({
        limit: analyticsLimit,
        fromAt: queryRange.fromAt,
        toAt: queryRange.toAt
      }));
      rangeEventsFailed = rangeEventsResult.failed;
      if (rangeEventsResult.rows.length > 0) {
        events = rangeEventsResult.rows;
      }
    }
  }
  if (events.length === 0) {
    const shouldFallbackEvents = fallbackOnEmpty || eventsResult.failed || rangeEventsFailed;
    if (!fallbackBlocked && shouldFallbackEvents) {
      events = await listAllEvents({ limit: analyticsLimit });
      addFallbackSource('listAllEvents');
    }
    if (fallbackBlocked && shouldFallbackEvents) {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (deliveries.length === 0) {
    if (queryRange.fromAt) {
      const rangeDeliveriesResult = await safeQuery(() => listNotificationDeliveriesBySentAtRange({
        limit: analyticsLimit,
        fromAt: queryRange.fromAt,
        toAt: queryRange.toAt
      }));
      rangeDeliveriesFailed = rangeDeliveriesResult.failed;
      if (rangeDeliveriesResult.rows.length > 0) {
        deliveries = rangeDeliveriesResult.rows;
      }
    }
  }
  if (deliveries.length === 0) {
    const shouldFallbackDeliveries = fallbackOnEmpty || deliveriesResult.failed || rangeDeliveriesFailed;
    if (!fallbackBlocked && shouldFallbackDeliveries) {
      deliveries = await listAllNotificationDeliveries({ limit: analyticsLimit });
      addFallbackSource('listAllNotificationDeliveries');
    }
    if (fallbackBlocked && shouldFallbackDeliveries) {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (checklistsResult.failed || checklists.length === 0) {
    if (!checklistsResult.failed && !fallbackOnEmpty) {
      // keep scoped empty result without global fallback
    } else if (!fallbackBlocked) {
      checklists = await listAllChecklists({ limit: analyticsLimit });
      addFallbackSource('listAllChecklists');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (userChecklistsResult.failed || userChecklists.length === 0) {
    if (!userChecklistsResult.failed && !fallbackOnEmpty) {
      // keep scoped empty result without global fallback
    } else if (!fallbackBlocked) {
      userChecklists = await listAllUserChecklists({ limit: analyticsLimit });
      addFallbackSource('listAllUserChecklists');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }

  const nowMs = Date.now();
  const hasMemberNumber = Boolean(data.memberNumber && String(data.memberNumber).trim().length > 0);
  const memberNumberStale = isMemberNumberStale(data, nowMs);

  const checklistTotal = countChecklistTotal(checklists, data.scenarioKey, data.stepKey);
  const checklistCompleted = countChecklistCompletedByUser(user, userChecklists);
  const lastActionAt = findLatestAction(events, user.id);
  const lastReactionAt = findLastReactionAt(deliveries, user.id);
  const notificationSummaryCompleteness = await resolveNotificationSummaryCompleteness(deliveries, user.id);

  const checklistEval = evaluateChecklistCompleteness(
    { totalItems: checklistTotal },
    { completedCount: checklistCompleted }
  );
  const registrationCompleteness = await evaluateRegistrationCompleteness(user, {
    listUsersByMemberNumber: usersRepo.listUsersByMemberNumber
  });
  const opsState = await opsStatesRepo.getOpsState(user.id);
  const opsStateCompleteness = evaluateOpsStateCompleteness(opsState);
  const userSummaryCompleteness = evaluateUserSummaryCompleteness({
    member: { hasMemberNumber, memberNumberStale },
    checklist: checklistEval
  });
  const opsDecisionCompleteness = await evaluateOpsDecisionCompleteness(opsState);
  const overallDecisionReadiness = evaluateOverallDecisionReadiness({
    registrationCompleteness,
    userSummaryCompleteness,
    notificationSummaryCompleteness,
    checklistCompleteness: checklistEval.completeness,
    opsStateCompleteness,
    opsDecisionCompleteness
  });

  const item = {
    lineUserId: user.id,
    hasMemberNumber,
    checklistCompleted,
    checklistTotal,
    checklist: checklistEval,
    notificationSummaryCompleteness,
    opsState,
    opsStateCompleteness,
    opsDecisionCompleteness,
    userSummaryCompleteness,
    overallDecisionReadiness,
    registrationCompleteness,
    lastActionAt,
    lastReactionAt
  };
  const computedAsOf = new Date().toISOString();
  return withMeta(item, {
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
  getUserStateSummary
};
