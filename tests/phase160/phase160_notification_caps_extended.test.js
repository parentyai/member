'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  normalizeNotificationCaps,
  evaluateNotificationCapsByCount
} = require('../../src/domain/notificationCaps');

test('phase160: notification caps normalize accepts extended fields', () => {
  const caps = normalizeNotificationCaps({
    perUserWeeklyCap: 7,
    perUserDailyCap: 2,
    perCategoryWeeklyCap: 3,
    quietHours: { startHourUtc: 22, endHourUtc: 7 }
  });
  assert.deepStrictEqual(caps, {
    perUserWeeklyCap: 7,
    perUserDailyCap: 2,
    perCategoryWeeklyCap: 3,
    quietHours: { startHourUtc: 22, endHourUtc: 7 }
  });
});

test('phase160: notification caps block during quiet hours', () => {
  const result = evaluateNotificationCapsByCount({
    notificationCaps: { quietHours: { startHourUtc: 22, endHourUtc: 7 } },
    now: new Date('2026-02-11T23:00:00.000Z')
  });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.capType, 'QUIET_HOURS');
  assert.strictEqual(result.reason, 'quiet_hours_active');
});

test('phase160: notification caps block when category is required but missing', () => {
  const result = evaluateNotificationCapsByCount({
    notificationCaps: { perCategoryWeeklyCap: 1 },
    deliveredCountCategoryWeekly: 0
  });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.capType, 'PER_CATEGORY_WEEKLY');
  assert.strictEqual(result.reason, 'notification_category_required_for_cap');
});

test('phase160: notification caps block per user daily before weekly', () => {
  const result = evaluateNotificationCapsByCount({
    notificationCaps: {
      perUserWeeklyCap: 5,
      perUserDailyCap: 2
    },
    deliveredCountDaily: 2,
    deliveredCountWeekly: 2
  });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.capType, 'PER_USER_DAILY');
  assert.strictEqual(result.reason, 'per_user_daily_cap_exceeded');
});
