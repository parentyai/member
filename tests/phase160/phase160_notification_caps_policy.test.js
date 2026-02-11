'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  normalizeNotificationCaps,
  evaluateNotificationCapsByCount
} = require('../../src/domain/notificationCaps');

test('phase160: notification caps normalize defaults to null', () => {
  assert.deepStrictEqual(normalizeNotificationCaps(null), {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });
  assert.deepStrictEqual(normalizeNotificationCaps(undefined), {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });
});

test('phase160: notification caps reject invalid values', () => {
  assert.throws(() => normalizeNotificationCaps({ perUserWeeklyCap: 0 }));
  assert.throws(() => normalizeNotificationCaps({ perUserWeeklyCap: 'x' }));
});

test('phase160: notification caps block when delivered count reaches cap', () => {
  const blocked = evaluateNotificationCapsByCount({
    notificationCaps: { perUserWeeklyCap: 2 },
    deliveredCountWeekly: 2
  });
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reason, 'per_user_weekly_cap_exceeded');

  const allowed = evaluateNotificationCapsByCount({
    notificationCaps: { perUserWeeklyCap: 2 },
    deliveredCountWeekly: 1
  });
  assert.strictEqual(allowed.allowed, true);
});
