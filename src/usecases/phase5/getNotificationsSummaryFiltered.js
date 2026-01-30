'use strict';

const { getNotificationOperationalSummary } = require('../admin/getNotificationOperationalSummary');

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

async function getNotificationsSummaryFiltered(params) {
  const payload = params || {};
  const items = await getNotificationOperationalSummary();
  return items.filter((item) => inRange(item.lastReactionAt || item.sentAt, payload.fromMs, payload.toMs));
}

module.exports = {
  getNotificationsSummaryFiltered
};
