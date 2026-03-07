'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeJourneyPolicy } = require('../../src/repos/firestore/journeyPolicyRepo');

test('phase746: normalizeJourneyPolicy keeps notificationCaps default contract', () => {
  const row = normalizeJourneyPolicy(null);
  assert.ok(row);
  assert.deepEqual(row.notificationCaps, {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });
});

test('phase746: normalizeJourneyPolicy accepts legacy notification_caps snake_case payload', () => {
  const row = normalizeJourneyPolicy({
    enabled: true,
    notification_caps: {
      per_user_weekly_cap: 5,
      per_user_daily_cap: 2,
      per_category_weekly_cap: 3,
      quiet_hours: {
        startHourUtc: 22,
        endHourUtc: 7
      }
    }
  });

  assert.ok(row);
  assert.deepEqual(row.notificationCaps, {
    perUserWeeklyCap: 5,
    perUserDailyCap: 2,
    perCategoryWeeklyCap: 3,
    quietHours: {
      startHourUtc: 22,
      endHourUtc: 7
    }
  });
});

test('phase746: normalizeJourneyPolicy accepts top-level quietHours for backward compatibility', () => {
  const row = normalizeJourneyPolicy({
    quietHours: {
      startHourUtc: 23,
      endHourUtc: 6
    }
  });
  assert.ok(row);
  assert.deepEqual(row.notificationCaps, {
    perUserWeeklyCap: null,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: {
      startHourUtc: 23,
      endHourUtc: 6
    }
  });
});

test('phase746: normalizeJourneyPolicy rejects invalid quietHours contract', () => {
  const row = normalizeJourneyPolicy({
    notificationCaps: {
      quietHours: {
        startHourUtc: 9,
        endHourUtc: 9
      }
    }
  });
  assert.equal(row, null);
});
