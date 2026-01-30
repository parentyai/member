'use strict';

const { getUserOperationalSummary } = require('../admin/getUserOperationalSummary');

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

async function getUsersSummaryFiltered(params) {
  const payload = params || {};
  const items = await getUserOperationalSummary();
  const nowMs = typeof payload.nowMs === 'number' ? payload.nowMs : Date.now();
  const enriched = items.map((item) => {
    const stale = isStaleMemberNumber(item, nowMs);
    const checklistIncomplete = isChecklistIncomplete(item);
    const needsAttention = !item.hasMemberNumber || checklistIncomplete || stale;
    return Object.assign({}, item, {
      stale,
      checklistIncomplete,
      needsAttention
    });
  });
  return enriched.filter((item) => inRange(item.lastActionAt, payload.fromMs, payload.toMs));
}

module.exports = {
  getUsersSummaryFiltered
};
