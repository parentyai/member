'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { getJourneyPrimaryNotificationDailyMax } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function resolveUtcDayStartIso(iso) {
  const parsed = Date.parse(iso);
  const base = Number.isFinite(parsed) ? new Date(parsed) : new Date();
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString();
}

function normalizeThreshold(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  return Math.max(0, Number(getJourneyPrimaryNotificationDailyMax() || 0));
}

async function computeNotificationFatigueWarning(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');
  const sentAtIso = normalizeIso(payload.sentAt || payload.now);
  const sinceAt = resolveUtcDayStartIso(sentAtIso);
  const threshold = normalizeThreshold(payload.dailyThreshold);
  const category = normalizeText(payload.notificationCategory).toUpperCase();
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.deliveriesRepo || deliveriesRepo;

  const deliveredTodayRaw = await repository.countDeliveredByUserSince(lineUserId, sinceAt).catch(() => 0);
  const deliveredToday = Number.isFinite(Number(deliveredTodayRaw)) ? Number(deliveredTodayRaw) : 0;

  let deliveredTodayByCategory = null;
  if (category && typeof repository.countDeliveredByUserCategorySince === 'function') {
    const byCategoryRaw = await repository
      .countDeliveredByUserCategorySince(lineUserId, category, sinceAt)
      .catch(() => null);
    if (Number.isFinite(Number(byCategoryRaw))) deliveredTodayByCategory = Number(byCategoryRaw);
  }

  const projectedDeliveredToday = deliveredToday + 1;
  const warn = projectedDeliveredToday > threshold;
  return {
    lineUserId,
    notificationCategory: category || null,
    sinceAt,
    sentAt: sentAtIso,
    deliveredToday,
    deliveredTodayByCategory,
    projectedDeliveredToday,
    threshold,
    warn,
    reason: warn ? 'daily_notification_volume_high' : null
  };
}

module.exports = {
  computeNotificationFatigueWarning
};
