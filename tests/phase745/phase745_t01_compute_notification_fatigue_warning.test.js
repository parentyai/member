'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeNotificationFatigueWarning } = require('../../src/usecases/notifications/computeNotificationFatigueWarning');

test('phase745: computeNotificationFatigueWarning returns warn payload when projected volume exceeds threshold', async () => {
  const result = await computeNotificationFatigueWarning({
    lineUserId: 'U745_A',
    sentAt: '2026-03-07T12:34:56.000Z',
    notificationCategory: 'sequence_guidance',
    dailyThreshold: 2
  }, {
    deliveriesRepo: {
      countDeliveredByUserSince: async () => 2,
      countDeliveredByUserCategorySince: async () => 1
    }
  });

  assert.equal(result.lineUserId, 'U745_A');
  assert.equal(result.notificationCategory, 'SEQUENCE_GUIDANCE');
  assert.equal(result.deliveredToday, 2);
  assert.equal(result.deliveredTodayByCategory, 1);
  assert.equal(result.projectedDeliveredToday, 3);
  assert.equal(result.threshold, 2);
  assert.equal(result.warn, true);
  assert.equal(result.reason, 'daily_notification_volume_high');
  assert.equal(result.sinceAt, '2026-03-07T00:00:00.000Z');
});

test('phase745: computeNotificationFatigueWarning falls back to env threshold and does not warn when under limit', async () => {
  const previous = process.env.JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX;
  process.env.JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX = '5';
  try {
    const result = await computeNotificationFatigueWarning({
      lineUserId: 'U745_B',
      sentAt: '2026-03-07T03:00:00.000Z',
      notificationCategory: 'deadline_required'
    }, {
      deliveriesRepo: {
        countDeliveredByUserSince: async () => 1,
        countDeliveredByUserCategorySince: async () => 1
      }
    });

    assert.equal(result.threshold, 5);
    assert.equal(result.warn, false);
    assert.equal(result.reason, null);
    assert.equal(result.projectedDeliveredToday, 2);
  } finally {
    if (previous === undefined) delete process.env.JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX;
    else process.env.JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX = previous;
  }
});
