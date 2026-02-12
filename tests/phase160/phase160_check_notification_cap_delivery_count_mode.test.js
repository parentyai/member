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
