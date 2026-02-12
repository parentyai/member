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
  if (notificationCaps.perUserWeeklyCap !== null) {
    deliveredCountWeekly = await countDeliveredByUserSince(lineUserId, weeklyWindowStart, countOptions);
  }
  if (notificationCaps.perUserDailyCap !== null) {
    deliveredCountDaily = await countDeliveredByUserSince(lineUserId, dailyWindowStart, countOptions);
  }
  if (notificationCaps.perCategoryWeeklyCap !== null && payload.notificationCategory) {
    deliveredCountCategoryWeekly = await countDeliveredByUserCategorySince(
      lineUserId,
      String(payload.notificationCategory),
      weeklyWindowStart,
      countOptions
    );
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
