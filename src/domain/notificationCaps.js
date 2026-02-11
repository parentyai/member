'use strict';

const MAX_CAP = 200;
const WEEK_WINDOW_DAYS = 7;
const DAY_WINDOW_HOURS = 24;

function normalizeNullableCap(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > MAX_CAP) {
    throw new Error(`invalid ${fieldName}`);
  }
  return num;
}

function normalizePerUserWeeklyCap(value) {
  return normalizeNullableCap(value, 'perUserWeeklyCap');
}

function normalizePerUserDailyCap(value) {
  return normalizeNullableCap(value, 'perUserDailyCap');
}

function normalizePerCategoryWeeklyCap(value) {
  return normalizeNullableCap(value, 'perCategoryWeeklyCap');
}

function normalizeHour(value, fieldName) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 23) {
    throw new Error(`invalid ${fieldName}`);
  }
  return num;
}

function normalizeQuietHours(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') throw new Error('invalid quietHours');
  const startHourUtc = normalizeHour(value.startHourUtc, 'quietHours.startHourUtc');
  const endHourUtc = normalizeHour(value.endHourUtc, 'quietHours.endHourUtc');
  if (startHourUtc === endHourUtc) throw new Error('invalid quietHours');
  return { startHourUtc, endHourUtc };
}

function normalizeNotificationCaps(value) {
  if (value === null || value === undefined) {
    return {
      perUserWeeklyCap: null,
      perUserDailyCap: null,
      perCategoryWeeklyCap: null,
      quietHours: null
    };
  }
  if (typeof value !== 'object') throw new Error('invalid notificationCaps');
  const perUserWeeklyCap = normalizePerUserWeeklyCap(value.perUserWeeklyCap);
  const perUserDailyCap = normalizePerUserDailyCap(value.perUserDailyCap);
  const perCategoryWeeklyCap = normalizePerCategoryWeeklyCap(value.perCategoryWeeklyCap);
  const quietHours = normalizeQuietHours(value.quietHours);
  if (perUserWeeklyCap !== null && perUserDailyCap !== null && perUserDailyCap > perUserWeeklyCap) {
    throw new Error('invalid notificationCaps: perUserDailyCap must be <= perUserWeeklyCap');
  }
  return {
    perUserWeeklyCap,
    perUserDailyCap,
    perCategoryWeeklyCap,
    quietHours
  };
}

function resolveWeeklyWindowStart(now) {
  const base = now instanceof Date ? now : new Date();
  return new Date(base.getTime() - (WEEK_WINDOW_DAYS * 24 * 60 * 60 * 1000));
}

function resolveDailyWindowStart(now) {
  const base = now instanceof Date ? now : new Date();
  return new Date(base.getTime() - (DAY_WINDOW_HOURS * 60 * 60 * 1000));
}

function isQuietHoursActive(now, quietHours) {
  if (!quietHours) return false;
  const base = now instanceof Date ? now : new Date();
  const hour = base.getUTCHours();
  const start = quietHours.startHourUtc;
  const end = quietHours.endHourUtc;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function normalizeCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function evaluateNotificationCapsByCount(params) {
  const payload = params || {};
  const caps = normalizeNotificationCaps(payload.notificationCaps);
  const deliveredCountWeekly = normalizeCount(payload.deliveredCountWeekly);
  const deliveredCountDaily = normalizeCount(payload.deliveredCountDaily);
  const deliveredCountCategoryWeekly = normalizeCount(payload.deliveredCountCategoryWeekly);
  const notificationCategory = typeof payload.notificationCategory === 'string' && payload.notificationCategory.trim().length > 0
    ? payload.notificationCategory.trim().toUpperCase()
    : null;
  const now = payload.now instanceof Date ? payload.now : new Date();

  const allNull = caps.perUserWeeklyCap === null
    && caps.perUserDailyCap === null
    && caps.perCategoryWeeklyCap === null
    && caps.quietHours === null;
  if (allNull) {
    return {
      enforced: false,
      allowed: true,
      reason: 'notification_cap_not_configured',
      capType: null,
      perUserWeeklyCap: null,
      perUserDailyCap: null,
      perCategoryWeeklyCap: null,
      quietHours: null,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly
    };
  }

  if (isQuietHoursActive(now, caps.quietHours)) {
    return {
      enforced: true,
      allowed: false,
      reason: 'quiet_hours_active',
      capType: 'QUIET_HOURS',
      perUserWeeklyCap: caps.perUserWeeklyCap,
      perUserDailyCap: caps.perUserDailyCap,
      perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
      quietHours: caps.quietHours,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory
    };
  }

  if (caps.perUserDailyCap !== null && deliveredCountDaily >= caps.perUserDailyCap) {
    return {
      enforced: true,
      allowed: false,
      reason: 'per_user_daily_cap_exceeded',
      capType: 'PER_USER_DAILY',
      perUserWeeklyCap: caps.perUserWeeklyCap,
      perUserDailyCap: caps.perUserDailyCap,
      perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
      quietHours: caps.quietHours,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory
    };
  }

  if (caps.perUserWeeklyCap !== null && deliveredCountWeekly >= caps.perUserWeeklyCap) {
    return {
      enforced: true,
      allowed: false,
      reason: 'per_user_weekly_cap_exceeded',
      capType: 'PER_USER_WEEKLY',
      perUserWeeklyCap: caps.perUserWeeklyCap,
      perUserDailyCap: caps.perUserDailyCap,
      perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
      quietHours: caps.quietHours,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory
    };
  }

  if (caps.perCategoryWeeklyCap !== null && !notificationCategory) {
    return {
      enforced: true,
      allowed: false,
      reason: 'notification_category_required_for_cap',
      capType: 'PER_CATEGORY_WEEKLY',
      perUserWeeklyCap: caps.perUserWeeklyCap,
      perUserDailyCap: caps.perUserDailyCap,
      perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
      quietHours: caps.quietHours,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory: null
    };
  }

  if (caps.perCategoryWeeklyCap !== null && deliveredCountCategoryWeekly >= caps.perCategoryWeeklyCap) {
    return {
      enforced: true,
      allowed: false,
      reason: 'per_category_weekly_cap_exceeded',
      capType: 'PER_CATEGORY_WEEKLY',
      perUserWeeklyCap: caps.perUserWeeklyCap,
      perUserDailyCap: caps.perUserDailyCap,
      perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
      quietHours: caps.quietHours,
      deliveredCountWeekly,
      deliveredCountDaily,
      deliveredCountCategoryWeekly,
      notificationCategory
    };
  }

  return {
    enforced: true,
    allowed: true,
    reason: 'notification_cap_allowed',
    capType: null,
    perUserWeeklyCap: caps.perUserWeeklyCap,
    perUserDailyCap: caps.perUserDailyCap,
    perCategoryWeeklyCap: caps.perCategoryWeeklyCap,
    quietHours: caps.quietHours,
    deliveredCountWeekly,
    deliveredCountDaily,
    deliveredCountCategoryWeekly,
    notificationCategory
  };
}

module.exports = {
  MAX_CAP,
  WEEK_WINDOW_DAYS,
  DAY_WINDOW_HOURS,
  normalizeNotificationCaps,
  normalizePerUserWeeklyCap,
  normalizePerUserDailyCap,
  normalizePerCategoryWeeklyCap,
  normalizeQuietHours,
  resolveWeeklyWindowStart,
  resolveDailyWindowStart,
  isQuietHoursActive,
  evaluateNotificationCapsByCount
};
