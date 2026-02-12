'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { checkNotificationCap } = require('../../src/usecases/notifications/checkNotificationCap');

test('phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters', async () => {
  const calls = [];
  const result = await checkNotificationCap({
    lineUserId: 'U1',
    notificationCaps: { perUserWeeklyCap: 5 },
    deliveryCountLegacyFallback: false
  }, {
    countDeliveredByUserSince: async (_lineUserId, _sinceAt, options) => {
      calls.push(options);
      return 0;
    }
  });

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], { includeLegacyFallback: false });
});

test('phase160: checkNotificationCap defaults includeLegacyFallback=true', async () => {
  const calls = [];
  const result = await checkNotificationCap({
    lineUserId: 'U2',
    notificationCaps: { perUserDailyCap: 2 }
  }, {
    countDeliveredByUserSince: async (_lineUserId, _sinceAt, options) => {
      calls.push(options);
      return 0;
    }
  });

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], { includeLegacyFallback: true });
});

test('phase160: checkNotificationCap skips delivery counters during active quietHours', async () => {
  let called = false;
  const result = await checkNotificationCap({
    lineUserId: 'U3',
    notificationCaps: {
      perUserWeeklyCap: 5,
      quietHours: { startHourUtc: 22, endHourUtc: 7 }
    },
    now: new Date('2026-02-11T23:00:00.000Z')
  }, {
    countDeliveredByUserSince: async () => {
      called = true;
      throw new Error('should not be called');
    },
    countDeliveredByUserCategorySince: async () => {
      called = true;
      throw new Error('should not be called');
    }
  });

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.capType, 'QUIET_HOURS');
  assert.strictEqual(result.reason, 'quiet_hours_active');
  assert.strictEqual(called, false);
  assert.strictEqual(result.dailyWindowStart, null);
  assert.strictEqual(result.weeklyWindowStart, null);
});
