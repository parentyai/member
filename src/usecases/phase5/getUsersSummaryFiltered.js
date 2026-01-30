'use strict';

const { getUserOperationalSummary } = require('../admin/getUserOperationalSummary');

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

async function getUsersSummaryFiltered(params) {
  const payload = params || {};
  const items = await getUserOperationalSummary();
  return items.filter((item) => inRange(item.lastActionAt, payload.fromMs, payload.toMs));
}

module.exports = {
  getUsersSummaryFiltered
};
