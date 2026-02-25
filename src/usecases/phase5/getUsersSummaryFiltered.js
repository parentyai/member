'use strict';

const { getUserOperationalSummary } = require('../admin/getUserOperationalSummary');
const { sortUsersSummaryStable } = require('./sortUsersSummaryStable');

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;
const PLAN_FILTER_SET = new Set(['free', 'pro']);
const SUBSCRIPTION_STATUS_FILTER_SET = new Set([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'unknown'
]);
const HOUSEHOLD_TYPE_FILTER_SET = new Set([
  'single',
  'couple',
  'accompany1',
  'accompany2'
]);
const BILLING_INTEGRITY_FILTER_SET = new Set([
  'ok',
  'unknown',
  'conflict'
]);
const QUICK_FILTER_SET = new Set([
  'all',
  'pro_active',
  'free',
  'trialing',
  'past_due',
  'canceled',
  'unknown'
]);
const SORT_KEY_TYPES = Object.freeze({
  createdAt: 'date',
  updatedAt: 'date',
  currentPeriodEnd: 'date',
  nextTodoDueAt: 'date',
  lineUserId: 'string',
  memberNumber: 'string',
  category: 'string',
  status: 'string',
  householdType: 'string',
  journeyStage: 'string',
  deliveryCount: 'number',
  clickCount: 'number',
  reactionRate: 'number',
  plan: 'string',
  subscriptionStatus: 'string',
  llmUsage: 'number',
  llmUsageToday: 'number',
  todoProgressRate: 'number',
  tokensToday: 'number',
  blockedRate: 'number',
  billingIntegrity: 'string',
  todoOpenCount: 'number',
  todoOverdueCount: 'number'
});

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function inRange(value, fromMs, toMs) {
  if (!fromMs && !toMs) return true;
  const ms = toMillis(value);
  if (!ms) return false;
  if (fromMs && ms < fromMs) return false;
  if (toMs && ms > toMs) return false;
  return true;
}

function isChecklistIncomplete(item) {
  if (!item || typeof item.checklistTotal !== 'number') return false;
  if (item.checklistTotal === 0) return false;
  return item.checklistCompleted < item.checklistTotal;
}

function isStaleMemberNumber(item, nowMs) {
  if (!item || item.hasMemberNumber) return false;
  if (!item.createdAtMs) return false;
  return nowMs - item.createdAtMs >= STALE_DAYS * DAY_MS;
}

function filterByNeedsAttention(item, flag) {
  if (!flag) return true;
  return item.needsAttention === true;
}

function filterByStale(item, flag) {
  if (!flag) return true;
  return item.stale === true;
}

function filterByUnreviewed(item, flag) {
  if (!flag) return true;
  return !item.opsReviewLastReviewedAt;
}

function filterByReviewAge(item, reviewAgeDays, nowMs) {
  if (!reviewAgeDays) return true;
  if (!item.opsReviewLastReviewedAt) return true;
  const reviewedMs = toMillis(item.opsReviewLastReviewedAt);
  if (!reviewedMs) return true;
  return nowMs - reviewedMs >= reviewAgeDays * DAY_MS;
}

function normalizePlanFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return PLAN_FILTER_SET.has(normalized) ? normalized : null;
}

function normalizeSubscriptionStatusFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return SUBSCRIPTION_STATUS_FILTER_SET.has(normalized) ? normalized : null;
}

function normalizeSortKey(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return Object.prototype.hasOwnProperty.call(SORT_KEY_TYPES, normalized) ? normalized : null;
}

function normalizeSortDir(value) {
  if (value === 'asc') return 'asc';
  if (value === 'desc') return 'desc';
  return null;
}

function normalizeHouseholdTypeFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return HOUSEHOLD_TYPE_FILTER_SET.has(normalized) ? normalized : null;
}

function normalizeJourneyStageFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return normalized;
}

function normalizeTodoStateFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  if (['open', 'overdue', 'none'].includes(normalized)) return normalized;
  return null;
}

function normalizeBillingIntegrityFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return null;
  return BILLING_INTEGRITY_FILTER_SET.has(normalized) ? normalized : null;
}

function normalizeQuickFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return QUICK_FILTER_SET.has(normalized) ? normalized : null;
}

function compareValues(baseA, baseB, valueType, direction) {
  const dir = direction === 'asc' ? 1 : -1;
  const aUnset = baseA === null || baseA === undefined || (typeof baseA === 'string' && baseA.trim().length === 0);
  const bUnset = baseB === null || baseB === undefined || (typeof baseB === 'string' && baseB.trim().length === 0);
  if (aUnset && bUnset) return 0;
  if (aUnset) return 1;
  if (bUnset) return -1;

  if (valueType === 'date') {
    const aMs = toMillis(baseA);
    const bMs = toMillis(baseB);
    const aMsUnset = !Number.isFinite(aMs);
    const bMsUnset = !Number.isFinite(bMs);
    if (aMsUnset && bMsUnset) return 0;
    if (aMsUnset) return 1;
    if (bMsUnset) return -1;
    if (aMs === bMs) return 0;
    return aMs > bMs ? dir : -dir;
  }

  if (valueType === 'number') {
    const aNum = Number(baseA);
    const bNum = Number(baseB);
    const aNumUnset = !Number.isFinite(aNum);
    const bNumUnset = !Number.isFinite(bNum);
    if (aNumUnset && bNumUnset) return 0;
    if (aNumUnset) return 1;
    if (bNumUnset) return -1;
    if (aNum === bNum) return 0;
    return aNum > bNum ? dir : -dir;
  }

  const aText = String(baseA);
  const bText = String(baseB);
  const compared = aText.localeCompare(bText, 'ja', { sensitivity: 'base', numeric: true });
  if (compared === 0) return 0;
  return compared > 0 ? dir : -dir;
}

function resolveSortValue(item, key) {
  if (key === 'category') return item && item.categoryLabel;
  if (key === 'status') return item && item.statusLabel;
  if (key === 'householdType') return item && item.householdType;
  if (key === 'journeyStage') return item && item.journeyStage;
  if (key === 'reactionRate') return item && item.reactionRate;
  if (key === 'currentPeriodEnd') return item && item.currentPeriodEnd;
  if (key === 'nextTodoDueAt') return item && item.nextTodoDueAt;
  if (key === 'updatedAt') return item && item.updatedAt;
  if (key === 'plan') return item && item.plan;
  if (key === 'subscriptionStatus') return item && item.subscriptionStatus;
  if (key === 'llmUsage') return item && item.llmUsage;
  if (key === 'llmUsageToday') return item && item.llmUsageToday;
  if (key === 'todoProgressRate') return item && item.todoProgressRate;
  if (key === 'tokensToday') return item && item.llmTokenUsedToday;
  if (key === 'blockedRate') return item && item.llmBlockedRate;
  if (key === 'billingIntegrity') return item && item.billingIntegrityState;
  if (key === 'todoOpenCount') return item && item.todoOpenCount;
  if (key === 'todoOverdueCount') return item && item.todoOverdueCount;
  return item ? item[key] : null;
}

function filterByQuickFilter(item, quickFilter) {
  if (!quickFilter || quickFilter === 'all') return true;
  const plan = String(item && item.plan ? item.plan : 'free');
  const status = String(item && item.subscriptionStatus ? item.subscriptionStatus : 'unknown');
  const integrity = String(item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown');
  if (quickFilter === 'pro_active') return plan === 'pro' && (status === 'active' || status === 'trialing');
  if (quickFilter === 'free') return plan === 'free';
  if (quickFilter === 'trialing') return status === 'trialing';
  if (quickFilter === 'past_due') return status === 'past_due';
  if (quickFilter === 'canceled') return status === 'canceled';
  if (quickFilter === 'unknown') return status === 'unknown' || integrity === 'unknown' || integrity === 'conflict';
  return true;
}

function sortUsersSummary(items, sortKey, sortDir) {
  const key = normalizeSortKey(sortKey);
  const dir = normalizeSortDir(sortDir);
  if (!key || !dir) {
    return sortUsersSummaryStable(items);
  }
  const valueType = SORT_KEY_TYPES[key] || 'string';
  const list = Array.isArray(items) ? items.slice() : [];
  list.sort((a, b) => {
    const compared = compareValues(resolveSortValue(a, key), resolveSortValue(b, key), valueType, dir);
    if (compared !== 0) return compared;
    return compareValues(a && a.lineUserId, b && b.lineUserId, 'string', 'asc');
  });
  return list;
}

async function getUsersSummaryFiltered(params) {
  const payload = params || {};
  const includeMeta = payload.includeMeta === true;
  const summary = await getUserOperationalSummary({
    limit: payload.limit,
    analyticsLimit: payload.analyticsLimit,
    snapshotMode: payload.snapshotMode,
    fallbackMode: payload.fallbackMode,
    fallbackOnEmpty: payload.fallbackOnEmpty,
    includeMeta
  });
  const baseItems = Array.isArray(summary) ? summary : (Array.isArray(summary && summary.items) ? summary.items : []);
  const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const planFilter = normalizePlanFilter(payload.plan);
  const subscriptionStatusFilter = normalizeSubscriptionStatusFilter(payload.subscriptionStatus);
  const householdTypeFilter = normalizeHouseholdTypeFilter(payload.householdType);
  const journeyStageFilter = normalizeJourneyStageFilter(payload.journeyStage);
  const todoStateFilter = normalizeTodoStateFilter(payload.todoState);
  const billingIntegrityFilter = normalizeBillingIntegrityFilter(payload.billingIntegrity);
  const quickFilter = normalizeQuickFilter(payload.quickFilter);
  const enriched = baseItems.map((item) => {
    const stale = isStaleMemberNumber(item, nowMs);
    const checklistIncomplete = isChecklistIncomplete(item);
    const needsAttention = !item.hasMemberNumber || checklistIncomplete || stale;
    return Object.assign({}, item, {
      stale,
      checklistIncomplete,
      needsAttention,
      opsFlags: {
        memberNumberStale: stale
      }
    });
  });
  const filtered = enriched
    .filter((item) => inRange(item.lastActionAt, payload.fromMs, payload.toMs))
    .filter((item) => filterByNeedsAttention(item, payload.needsAttention))
    .filter((item) => filterByStale(item, payload.stale))
    .filter((item) => filterByUnreviewed(item, payload.unreviewed))
    .filter((item) => filterByReviewAge(item, payload.reviewAgeDays, nowMs))
    .filter((item) => {
      if (!planFilter) return true;
      return String(item && item.plan ? item.plan : 'free') === planFilter;
    })
    .filter((item) => {
      if (!subscriptionStatusFilter) return true;
      return String(item && item.subscriptionStatus ? item.subscriptionStatus : 'unknown') === subscriptionStatusFilter;
    })
    .filter((item) => {
      if (!householdTypeFilter) return true;
      return String(item && item.householdType ? item.householdType : '').toLowerCase() === householdTypeFilter;
    })
    .filter((item) => {
      if (!journeyStageFilter) return true;
      return String(item && item.journeyStage ? item.journeyStage : '').toLowerCase() === journeyStageFilter;
    })
    .filter((item) => {
      if (!todoStateFilter) return true;
      const openCount = Number(item && item.todoOpenCount);
      const overdueCount = Number(item && item.todoOverdueCount);
      if (todoStateFilter === 'open') return Number.isFinite(openCount) && openCount > 0;
      if (todoStateFilter === 'overdue') return Number.isFinite(overdueCount) && overdueCount > 0;
      if (todoStateFilter === 'none') return !Number.isFinite(openCount) || openCount <= 0;
      return true;
    })
    .filter((item) => filterByQuickFilter(item, quickFilter))
    .filter((item) => {
      if (!billingIntegrityFilter) return true;
      return String(item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown') === billingIntegrityFilter;
    });
  const items = sortUsersSummary(filtered, payload.sortKey, payload.sortDir);
  if (!includeMeta) return items;
  return {
    items,
    meta: {
      dataSource: meta && meta.dataSource ? meta.dataSource : 'not_available',
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null,
      fallbackUsed: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackUsed') ? meta.fallbackUsed : false,
      fallbackBlocked: meta && Object.prototype.hasOwnProperty.call(meta, 'fallbackBlocked') ? meta.fallbackBlocked : false,
      fallbackSources: meta && Array.isArray(meta.fallbackSources) ? meta.fallbackSources : []
    }
  };
}

module.exports = {
  getUsersSummaryFiltered
};
