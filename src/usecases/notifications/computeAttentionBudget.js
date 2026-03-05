'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { getJourneyDailyAttentionBudgetMax } = require('../../domain/tasks/featureFlags');

function normalizeTimezone(value) {
  if (typeof value !== 'string') return 'UTC';
  const candidate = value.trim();
  if (!candidate) return 'UTC';
  try {
    // Validate IANA timezone.
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (_err) {
    return 'UTC';
  }
}

function getDateParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const out = {};
  parts.forEach((part) => {
    if (part.type === 'year') out.year = Number(part.value);
    if (part.type === 'month') out.month = Number(part.value);
    if (part.type === 'day') out.day = Number(part.value);
    if (part.type === 'hour') out.hour = Number(part.value);
    if (part.type === 'minute') out.minute = Number(part.value);
    if (part.type === 'second') out.second = Number(part.value);
  });
  return out;
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getDateParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year || 1970,
    Math.max((parts.month || 1) - 1, 0),
    Math.max(parts.day || 1, 1),
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0
  );
  return asUtc - date.getTime();
}

function resolveStartOfDay(now, timeZone) {
  const parts = getDateParts(now, timeZone);
  const utcMidnight = new Date(Date.UTC(
    parts.year || now.getUTCFullYear(),
    Math.max((parts.month || (now.getUTCMonth() + 1)) - 1, 0),
    Math.max(parts.day || now.getUTCDate(), 1),
    0,
    0,
    0
  ));
  const offset = getTimeZoneOffsetMs(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offset);
}

async function computeAttentionBudget(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const deliveries = resolvedDeps.deliveriesRepo || deliveriesRepo;
  const lineUserId = typeof payload.lineUserId === 'string' ? payload.lineUserId.trim() : '';
  if (!lineUserId) throw new Error('lineUserId required');

  const now = payload.now ? new Date(payload.now) : new Date();
  const nowDate = Number.isNaN(now.getTime()) ? new Date() : now;
  const timezone = normalizeTimezone(payload.timezone);
  const dayStartAt = resolveStartOfDay(nowDate, timezone).toISOString();
  const max = Number.isFinite(Number(payload.maxPerDay))
    ? Math.max(1, Math.floor(Number(payload.maxPerDay)))
    : getJourneyDailyAttentionBudgetMax();
  const used = await deliveries.countDeliveredByUserSince(lineUserId, dayStartAt).catch(() => 0);
  const remaining = Math.max(0, max - Number(used || 0));
  return {
    lineUserId,
    timezone,
    now: nowDate.toISOString(),
    dayStartAt,
    maxPerDay: max,
    usedCount: Number(used || 0),
    remainingCount: remaining
  };
}

module.exports = {
  computeAttentionBudget,
  resolveStartOfDay,
  normalizeTimezone
};
