'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const {
  normalizeNotificationCaps,
  resolveWeeklyWindowStart,
  resolveDailyWindowStart,
  isQuietHoursActive,
  evaluateNotificationCapsByCount
} = require('../../domain/notificationCaps');

async function checkNotificationCap(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');
  const notificationCaps = normalizeNotificationCaps(payload.notificationCaps);
  const now = payload.now instanceof Date ? payload.now : new Date();
  const allNull = notificationCaps.perUserWeeklyCap === null
    && notificationCaps.perUserDailyCap === null
    && notificationCaps.perCategoryWeeklyCap === null
    && notificationCaps.quietHours === null;
  if (allNull) {
    return Object.assign(
      evaluateNotificationCapsByCount({
        notificationCaps,
        now,
        deliveredCountDaily: 0,
        deliveredCountWeekly: 0,
        deliveredCountCategoryWeekly: 0,
        notificationCategory: payload.notificationCategory || null
      }),
      { dailyWindowStart: null, weeklyWindowStart: null }
    );
  }

  if (isQuietHoursActive(now, notificationCaps.quietHours)) {
    return Object.assign(
      evaluateNotificationCapsByCount({
        notificationCaps,
        now,
        deliveredCountDaily: 0,
        deliveredCountWeekly: 0,
        deliveredCountCategoryWeekly: 0,
        notificationCategory: payload.notificationCategory || null
      }),
      { dailyWindowStart: null, weeklyWindowStart: null }
    );
  }

  const weeklyWindowStart = resolveWeeklyWindowStart(now);
  const dailyWindowStart = resolveDailyWindowStart(now);

  const getDeliveredCountsSnapshot = deps && deps.getDeliveredCountsSnapshot
    ? deps.getDeliveredCountsSnapshot
    : deliveriesRepo.getDeliveredCountsSnapshot;
  const countDeliveredByUserSince = deps && deps.countDeliveredByUserSince
    ? deps.countDeliveredByUserSince
    : deliveriesRepo.countDeliveredByUserSince;
  const countDeliveredByUserCategorySince = deps && deps.countDeliveredByUserCategorySince
    ? deps.countDeliveredByUserCategorySince
    : deliveriesRepo.countDeliveredByUserCategorySince;
  const includeLegacyFallback = payload.deliveryCountLegacyFallback !== false;
  const countOptions = { includeLegacyFallback };

  let deliveredCountWeekly = 0;
  let deliveredCountDaily = 0;
  let deliveredCountCategoryWeekly = 0;
  const hasCountOverrides = Boolean(
    deps
      && (typeof deps.countDeliveredByUserSince === 'function'
      || typeof deps.countDeliveredByUserCategorySince === 'function')
  );
  const hasSnapshotOverride = Boolean(deps && typeof deps.getDeliveredCountsSnapshot === 'function');
  const normalizedCategory = payload.notificationCategory
    ? String(payload.notificationCategory).trim().toUpperCase()
    : '';

  if ((hasSnapshotOverride || !hasCountOverrides) && typeof getDeliveredCountsSnapshot === 'function') {
    const snapshot = await getDeliveredCountsSnapshot(lineUserId, {
      weeklySinceAt: weeklyWindowStart,
      dailySinceAt: notificationCaps.perUserDailyCap !== null ? dailyWindowStart : null,
      categories: notificationCaps.perCategoryWeeklyCap !== null && normalizedCategory
        ? [normalizedCategory]
        : [],
      includeLegacyFallback
    });
    if (notificationCaps.perUserWeeklyCap !== null) {
      deliveredCountWeekly = Number.isFinite(snapshot.weeklyCount) ? snapshot.weeklyCount : 0;
    }
    if (notificationCaps.perUserDailyCap !== null) {
      deliveredCountDaily = Number.isFinite(snapshot.dailyCount) ? snapshot.dailyCount : 0;
    }
    if (notificationCaps.perCategoryWeeklyCap !== null && normalizedCategory) {
      const byCategory = snapshot.categoryWeeklyCounts && typeof snapshot.categoryWeeklyCounts === 'object'
        ? snapshot.categoryWeeklyCounts
        : {};
      deliveredCountCategoryWeekly = Number.isFinite(byCategory[normalizedCategory])
        ? byCategory[normalizedCategory]
        : 0;
    }
  } else {
    if (notificationCaps.perUserWeeklyCap !== null) {
      deliveredCountWeekly = await countDeliveredByUserSince(lineUserId, weeklyWindowStart, countOptions);
    }
    if (notificationCaps.perUserDailyCap !== null) {
      deliveredCountDaily = await countDeliveredByUserSince(lineUserId, dailyWindowStart, countOptions);
    }
    if (notificationCaps.perCategoryWeeklyCap !== null && normalizedCategory) {
      deliveredCountCategoryWeekly = await countDeliveredByUserCategorySince(
        lineUserId,
        normalizedCategory,
        weeklyWindowStart,
        countOptions
      );
    }
  }

  return Object.assign(
    evaluateNotificationCapsByCount({
      notificationCaps,
      now,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory: payload.notificationCategory || null
    }),
    {
      dailyWindowStart: dailyWindowStart.toISOString(),
      weeklyWindowStart: weeklyWindowStart.toISOString()
    }
  );
}

module.exports = {
  checkNotificationCap
};
