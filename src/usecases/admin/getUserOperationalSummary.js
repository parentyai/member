'use strict';

const {
  listEventsByCreatedAtRange,
  listEventsByLineUserIdsAndCreatedAtRange,
  listChecklistsByCreatedAtRange,
  listChecklistsByScenarioAndStep,
  listChecklistsByScenarioStepPairs,
  listUserChecklistsByCreatedAtRange,
  listUserChecklistsByLineUserIds,
  listNotificationDeliveriesBySentAtRange,
  listNotificationDeliveriesByLineUserIdsAndSentAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');
const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed,
  resolveSnapshotFreshnessMinutes,
  isSnapshotFresh
} = require('../../domain/readModel/snapshotReadPolicy');
const {
  FALLBACK_MODE_BLOCK,
  resolveFallbackMode
} = require('../../domain/readModel/fallbackPolicy');
const DEFAULT_ANALYTICS_LIMIT = 1200;
const MAX_ANALYTICS_LIMIT = 2000;
const SNAPSHOT_TYPE = 'user_operational_summary';
const SNAPSHOT_KEY = 'latest';
const DEFAULT_LIST_LIMIT = null;
const MAX_LIST_LIMIT = 500;

function resolveAnalyticsLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_ANALYTICS_LIMIT;
  return Math.min(Math.floor(num), MAX_ANALYTICS_LIMIT);
}

function resolveListLimit(value, analyticsLimit) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_LIST_LIMIT;
  const bounded = Math.min(Math.floor(num), MAX_LIST_LIMIT);
  if (Number.isFinite(analyticsLimit) && analyticsLimit > 0) {
    return Math.min(bounded, analyticsLimit);
  }
  return bounded;
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

function buildDeliveryStatsByUser(deliveries) {
  const stats = new Map();
  for (const delivery of deliveries) {
    const data = delivery && delivery.data ? delivery.data : {};
    const lineUserId = typeof data.lineUserId === 'string' ? data.lineUserId : '';
    if (!lineUserId) continue;
    const current = stats.get(lineUserId) || { deliveryCount: 0, clickCount: 0 };
    current.deliveryCount += 1;
    if (toMillis(data.clickAt)) current.clickCount += 1;
    stats.set(lineUserId, current);
  }
  return stats;
}

function resolveReactionRate(clickCount, deliveryCount) {
  if (!Number.isFinite(deliveryCount) || deliveryCount <= 0) return null;
  if (!Number.isFinite(clickCount) || clickCount < 0) return null;
  return Math.round((clickCount / deliveryCount) * 10000) / 10000;
}

function resolveBillingIntegrityState(subscription, plan, subscriptionStatus) {
  if (!subscription) return 'unknown';
  const status = String(subscriptionStatus || 'unknown');
  if (status === 'unknown') return 'unknown';
  const rawPlan = String(subscription.plan || '').toLowerCase();
  const activeLike = status === 'active' || status === 'trialing';
  if (rawPlan === 'pro' && !activeLike) return 'conflict';
  if (rawPlan === 'free' && activeLike) return 'conflict';
  if (!rawPlan) return 'unknown';
  if (plan === 'free' && activeLike) return 'conflict';
  return 'ok';
}

function collectScenarioStepPairs(users) {
  const pairSet = new Set();
  (users || []).forEach((user) => {
    const data = user && user.data ? user.data : (user || {});
    const scenarioKey = typeof data.scenarioKey === 'string' ? data.scenarioKey.trim() : '';
    const stepKey = typeof data.stepKey === 'string' ? data.stepKey.trim() : '';
    if (!scenarioKey || !stepKey) return;
    pairSet.add(`${scenarioKey}__${stepKey}`);
  });
  return Array.from(pairSet.values()).map((key) => {
    const parts = key.split('__');
    return { scenarioKey: parts[0], stepKey: parts[1] };
  });
}

function collectLineUserIds(users) {
  return Array.from(new Set((users || []).map((user) => (user && user.id ? String(user.id).trim() : '')).filter(Boolean)));
}

function buildKeyedMap(rows, keyField) {
  const out = new Map();
  (rows || []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = typeof row[keyField] === 'string' ? row[keyField].trim() : '';
    if (!key) return;
    out.set(key, row);
  });
  return out;
}

function dedupeRowsById(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (!row || !row.id) return;
    if (!map.has(row.id)) map.set(row.id, row);
  });
  return Array.from(map.values());
}

async function safeQuery(queryFn) {
  try {
    const rows = await queryFn();
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch (_err) {
    return { rows: [], failed: true };
  }
}

async function getUserOperationalSummary(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const fallbackMode = resolveFallbackMode(opts.fallbackMode);
  const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;
  const fallbackOnEmpty = opts.fallbackOnEmpty === true;
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
      return withMeta(snapshot.data.items, {
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
  const analyticsLimit = resolveAnalyticsLimit(opts.analyticsLimit);
  const listLimit = resolveListLimit(opts.limit, analyticsLimit);
  const users = await usersRepo.listUsers({ limit: analyticsLimit });
  const scopedUsers = listLimit ? users.slice(0, listLimit) : users;
  const queryRange = resolveAnalyticsQueryRangeFromUsers(scopedUsers);
  const checklistPairs = collectScenarioStepPairs(scopedUsers);
  const scopedLineUserIds = collectLineUserIds(scopedUsers);
  const subscriptionsPromise = userSubscriptionsRepo.listUserSubscriptionsByLineUserIds({
    lineUserIds: scopedLineUserIds
  }).catch(() => []);
  const usageStatsPromise = llmUsageStatsRepo.listUserUsageStatsByLineUserIds({
    lineUserIds: scopedLineUserIds
  }).catch(() => []);
  const journeyProfilesPromise = userJourneyProfilesRepo.listUserJourneyProfilesByLineUserIds({
    lineUserIds: scopedLineUserIds
  }).catch(() => []);
  const journeySchedulesPromise = userJourneySchedulesRepo.listUserJourneySchedulesByLineUserIds({
    lineUserIds: scopedLineUserIds
  }).catch(() => []);
  const journeyTodoStatsPromise = journeyTodoStatsRepo.listUserJourneyTodoStatsByLineUserIds({
    lineUserIds: scopedLineUserIds
  }).catch(() => []);
  const checklistsPromise = safeQuery(() => listChecklistsByScenarioStepPairs({
    pairs: checklistPairs,
    limit: analyticsLimit
  }));
  let eventsPromise = Promise.resolve({ rows: [], failed: false });
  let deliveriesPromise = Promise.resolve({ rows: [], failed: false });
  const userChecklistsPromise = safeQuery(() => listUserChecklistsByLineUserIds({
    lineUserIds: scopedLineUserIds,
    limit: analyticsLimit
  }));
  if (queryRange.fromAt && scopedLineUserIds.length > 0) {
    eventsPromise = safeQuery(() => listEventsByLineUserIdsAndCreatedAtRange({
      lineUserIds: scopedLineUserIds,
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }));
    deliveriesPromise = safeQuery(() => listNotificationDeliveriesByLineUserIdsAndSentAtRange({
      lineUserIds: scopedLineUserIds,
      limit: analyticsLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }));
  }
  let [eventsResult, checklistsResult, userChecklistsResult, deliveriesResult, subscriptions, usageStats, journeyProfiles, journeySchedules, journeyTodoStats] = await Promise.all([
    eventsPromise,
    checklistsPromise,
    userChecklistsPromise,
    deliveriesPromise,
    subscriptionsPromise,
    usageStatsPromise,
    journeyProfilesPromise,
    journeySchedulesPromise,
    journeyTodoStatsPromise
  ]);
  let checklists = dedupeRowsById(checklistsResult.rows);
  let userChecklists = dedupeRowsById(userChecklistsResult.rows);
  let events = dedupeRowsById(eventsResult.rows);
  let deliveries = dedupeRowsById(deliveriesResult.rows);
  let rangeEventsFailed = false;
  let rangeDeliveriesFailed = false;
  let fallbackBlockedNotAvailable = false;

  if (checklists.length === 0 && checklistPairs.length === 1) {
    const pair = checklistPairs[0];
    const singlePairResult = await safeQuery(() => listChecklistsByScenarioAndStep({
      scenario: pair.scenarioKey,
      step: pair.stepKey,
      limit: analyticsLimit
    }));
    if (singlePairResult.rows.length > 0) {
      checklists = dedupeRowsById(singlePairResult.rows);
    }
  }

  if (events.length === 0) {
    if (queryRange.fromAt) {
      const rangeEventsResult = await safeQuery(() => listEventsByCreatedAtRange({
        limit: analyticsLimit,
        fromAt: queryRange.fromAt,
        toAt: queryRange.toAt
      }));
      rangeEventsFailed = rangeEventsResult.failed;
      if (rangeEventsResult.rows.length > 0) {
        events = dedupeRowsById(rangeEventsResult.rows);
      }
    }
  }
  if (events.length === 0) {
    const shouldFallbackEvents = fallbackOnEmpty || eventsResult.failed || rangeEventsFailed;
    if (!fallbackBlocked && shouldFallbackEvents) {
      events = await listEventsByCreatedAtRange({ limit: analyticsLimit });
      addFallbackSource('listEventsByCreatedAtRange:fallback');
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
        deliveries = dedupeRowsById(rangeDeliveriesResult.rows);
      }
    }
  }
  if (deliveries.length === 0) {
    const shouldFallbackDeliveries = fallbackOnEmpty || deliveriesResult.failed || rangeDeliveriesFailed;
    if (!fallbackBlocked && shouldFallbackDeliveries) {
      deliveries = await listNotificationDeliveriesBySentAtRange({ limit: analyticsLimit });
      addFallbackSource('listNotificationDeliveriesBySentAtRange:fallback');
    }
    if (fallbackBlocked && shouldFallbackDeliveries) {
      fallbackBlockedNotAvailable = true;
    }
  }

  if (checklistsResult.failed || checklists.length === 0) {
    if (!checklistsResult.failed && !fallbackOnEmpty) {
      // keep scoped empty result without global fallback
    } else if (!fallbackBlocked) {
      checklists = await listChecklistsByCreatedAtRange({ limit: analyticsLimit });
      addFallbackSource('listChecklistsByCreatedAtRange:fallback');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (userChecklistsResult.failed || userChecklists.length === 0) {
    if (!userChecklistsResult.failed && !fallbackOnEmpty) {
      // keep scoped empty result without global fallback
    } else if (!fallbackBlocked) {
      userChecklists = await listUserChecklistsByCreatedAtRange({ limit: analyticsLimit });
      addFallbackSource('listUserChecklistsByCreatedAtRange:fallback');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }
  const totals = buildChecklistTotals(checklists);
  const completedByUser = buildCompletedByUser(userChecklists);
  const latestActionByUser = buildLatestActionByUser(events);
  const latestReactionByUser = buildLatestReactionByUser(deliveries);
  const deliveryStatsByUser = buildDeliveryStatsByUser(deliveries);
  const subscriptionByUser = buildKeyedMap(subscriptions, 'lineUserId');
  const usageByUser = buildKeyedMap(usageStats, 'lineUserId');
  const journeyProfileByUser = buildKeyedMap(journeyProfiles, 'lineUserId');
  const journeyScheduleByUser = buildKeyedMap(journeySchedules, 'lineUserId');
  const journeyTodoStatsByUser = buildKeyedMap(journeyTodoStats, 'lineUserId');

  const items = scopedUsers.map((user) => {
    const data = user && user.data ? user.data : (user || {});
    const createdAtMs = toMillis(data.createdAt);
    const scenarioKey = typeof data.scenarioKey === 'string' ? data.scenarioKey : null;
    const stepKey = typeof data.stepKey === 'string' ? data.stepKey : null;
    const memberNumber = typeof data.memberNumber === 'string' && data.memberNumber.trim().length > 0
      ? data.memberNumber.trim()
      : null;
    const key = scenarioKey && stepKey ? `${scenarioKey}__${stepKey}` : null;
    const total = key ? (totals.get(key) || 0) : 0;
    const hasChecklistDone = data.checklistDone && typeof data.checklistDone === 'object';
    const completed = hasChecklistDone ? Object.keys(data.checklistDone).length : (completedByUser.get(user.id) || 0);
    const latest = latestActionByUser.get(user.id);
    const latestClick = latestReactionByUser.latestClick.get(user.id);
    const latestRead = latestReactionByUser.latestRead.get(user.id);
    const deliveryStats = deliveryStatsByUser.get(user.id) || { deliveryCount: 0, clickCount: 0 };
    const subscription = subscriptionByUser.get(user.id) || null;
    const usage = usageByUser.get(user.id) || null;
    const journeyProfile = journeyProfileByUser.get(user.id) || null;
    const journeySchedule = journeyScheduleByUser.get(user.id) || null;
    const journeyStats = journeyTodoStatsByUser.get(user.id) || null;
    const deliveryCount = Number.isFinite(deliveryStats.deliveryCount) ? deliveryStats.deliveryCount : 0;
    const clickCount = Number.isFinite(deliveryStats.clickCount) ? deliveryStats.clickCount : 0;
    const lastReactionAt = latestClick
      ? formatTimestamp(latestClick.value)
      : (latestRead ? formatTimestamp(latestRead.value) : null);
    const subscriptionStatus = subscription && subscription.status ? subscription.status : 'unknown';
    const currentPeriodEnd = subscription && subscription.currentPeriodEnd ? subscription.currentPeriodEnd : null;
    const plan = subscription && subscription.plan === 'pro' && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')
      ? 'pro'
      : 'free';
    const llmUsage = usage && Number.isFinite(Number(usage.usageCount)) ? Number(usage.usageCount) : 0;
    const llmTokenUsed = usage && Number.isFinite(Number(usage.totalTokenUsed)) ? Number(usage.totalTokenUsed) : 0;
    const llmBlockedCount = usage && Number.isFinite(Number(usage.blockedCount)) ? Number(usage.blockedCount) : 0;
    const llmUsageToday = usage && Number.isFinite(Number(usage.dailyUsageCount)) ? Number(usage.dailyUsageCount) : 0;
    const llmTokenUsedToday = usage && Number.isFinite(Number(usage.dailyTokenUsed)) ? Number(usage.dailyTokenUsed) : 0;
    const llmBlockedToday = usage && Number.isFinite(Number(usage.dailyBlockedCount))
      ? Number(usage.dailyBlockedCount)
      : Math.min(llmUsageToday, llmBlockedCount);
    const llmBlockedRate = llmUsageToday > 0
      ? Math.round((llmBlockedToday / llmUsageToday) * 10000) / 10000
      : 0;
    const billingIntegrityState = resolveBillingIntegrityState(subscription, plan, subscriptionStatus);
    const householdType = journeyProfile && journeyProfile.householdType
      ? String(journeyProfile.householdType)
      : null;
    const journeyStage = journeySchedule && journeySchedule.stage
      ? String(journeySchedule.stage)
      : null;
    const todoOpenCount = journeyStats && Number.isFinite(Number(journeyStats.openCount))
      ? Number(journeyStats.openCount)
      : 0;
    const todoTotalCount = journeyStats && Number.isFinite(Number(journeyStats.totalCount))
      ? Number(journeyStats.totalCount)
      : (todoOpenCount + (journeyStats && Number.isFinite(Number(journeyStats.completedCount)) ? Number(journeyStats.completedCount) : 0));
    const todoCompletedCount = journeyStats && Number.isFinite(Number(journeyStats.completedCount))
      ? Number(journeyStats.completedCount)
      : Math.max(0, todoTotalCount - todoOpenCount);
    const todoLockedCount = journeyStats && Number.isFinite(Number(journeyStats.lockedCount))
      ? Number(journeyStats.lockedCount)
      : 0;
    const todoActionableCount = journeyStats && Number.isFinite(Number(journeyStats.actionableCount))
      ? Number(journeyStats.actionableCount)
      : Math.max(0, todoOpenCount - todoLockedCount);
    const taskCompletionRate = journeyStats && Number.isFinite(Number(journeyStats.completionRate))
      ? Number(journeyStats.completionRate)
      : (todoTotalCount > 0 ? Math.round((todoCompletedCount / todoTotalCount) * 10000) / 10000 : 0);
    const dependencyBlockRate = journeyStats && Number.isFinite(Number(journeyStats.dependencyBlockRate))
      ? Number(journeyStats.dependencyBlockRate)
      : (todoOpenCount > 0 ? Math.round((todoLockedCount / todoOpenCount) * 10000) / 10000 : 0);
    const todoProgressRate = taskCompletionRate;
    const todoOverdueCount = journeyStats && Number.isFinite(Number(journeyStats.overdueCount))
      ? Number(journeyStats.overdueCount)
      : 0;
    const nextTodoDueAt = journeyStats && journeyStats.nextDueAt
      ? formatTimestamp(journeyStats.nextDueAt)
      : null;
    return {
      lineUserId: user.id,
      createdAt: formatTimestamp(data.createdAt),
      createdAtMs,
      updatedAt: formatTimestamp((subscription && subscription.updatedAt) || data.updatedAt || data.createdAt),
      opsReviewLastReviewedAt: formatTimestamp(data.opsReviewLastReviewedAt),
      opsReviewLastReviewedBy: data.opsReviewLastReviewedBy || null,
      memberNumber,
      scenarioKey,
      stepKey,
      hasMemberNumber: Boolean(memberNumber),
      checklistCompleted: completed,
      checklistTotal: total,
      lastActionAt: latest ? formatTimestamp(latest.value) : null,
      lastReactionAt,
      deliveryCount,
      clickCount,
      reactionRate: resolveReactionRate(clickCount, deliveryCount),
      plan,
      subscriptionStatus,
      currentPeriodEnd,
      subscriptionUpdatedAt: subscription && subscription.updatedAt ? formatTimestamp(subscription.updatedAt) : null,
      lastStripeEventId: subscription && subscription.lastEventId ? subscription.lastEventId : null,
      llmUsage,
      llmUsageToday,
      llmTokenUsed,
      llmTokenUsedToday,
      llmBlockedCount,
      llmBlockedToday,
      llmBlockedRate,
      billingIntegrityState,
      householdType,
      journeyStage,
      todoTotalCount,
      todoCompletedCount,
      todoLockedCount,
      todoActionableCount,
      taskCompletionRate,
      dependencyBlockRate,
      todoProgressRate,
      todoOpenCount,
      todoOverdueCount,
      nextTodoDueAt
    };
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
  getUserOperationalSummary
};
