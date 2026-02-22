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
  const includeMeta = payload.includeMeta === true;
  const summary = await getNotificationOperationalSummary({
    limit: payload.limit,
    eventsLimit: payload.eventsLimit,
    snapshotMode: payload.snapshotMode,
    fallbackMode: payload.fallbackMode,
    fallbackOnEmpty: payload.fallbackOnEmpty,
    includeMeta
  });
  const baseItems = Array.isArray(summary) ? summary : (Array.isArray(summary && summary.items) ? summary.items : []);
  const meta = summary && !Array.isArray(summary) && summary.meta ? summary.meta : null;
  const items = baseItems.filter((item) => inRange(item.lastReactionAt || item.sentAt, payload.fromMs, payload.toMs));
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
  getNotificationsSummaryFiltered
};
