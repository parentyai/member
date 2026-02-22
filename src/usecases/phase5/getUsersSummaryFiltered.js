'use strict';

const { getUserOperationalSummary } = require('../admin/getUserOperationalSummary');
const { sortUsersSummaryStable } = require('./sortUsersSummaryStable');

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

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

async function getUsersSummaryFiltered(params) {
  const payload = params || {};
  const includeMeta = payload.includeMeta === true;
  const summary = await getUserOperationalSummary({
    limit: payload.limit,
    analyticsLimit: payload.analyticsLimit,
    snapshotMode: payload.snapshotMode,
    fallbackMode: payload.fallbackMode,
    includeMeta
  });
  const baseItems = Array.isArray(summary) ? summary : (Array.isArray(summary && summary.items) ? summary.items : []);
  const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
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
    .filter((item) => filterByReviewAge(item, payload.reviewAgeDays, nowMs));
  const items = sortUsersSummaryStable(filtered);
  if (!includeMeta) return items;
  return {
    items,
    meta: {
      dataSource: meta && meta.dataSource ? meta.dataSource : 'not_available',
      asOf: meta && Object.prototype.hasOwnProperty.call(meta, 'asOf') ? meta.asOf : null,
      freshnessMinutes: meta && Object.prototype.hasOwnProperty.call(meta, 'freshnessMinutes') ? meta.freshnessMinutes : null
    }
  };
}

module.exports = {
  getUsersSummaryFiltered
};
