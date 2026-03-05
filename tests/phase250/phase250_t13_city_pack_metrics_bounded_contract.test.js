'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { computeCityPackMetrics } = require('../../src/usecases/cityPack/computeCityPackMetrics');

test('phase250: metrics prefers daily rows and preserves response contract with bounded meta', async () => {
  const prevBounded = process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1;
  const prevDailyPreferred = process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1;
  const prevLimitMax = process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX;
  process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1 = '1';
  process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1 = '1';
  process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX = '2000';

  try {
    let rangeCalls = 0;
    const result = await computeCityPackMetrics({
      windowDays: 7,
      limit: 50,
      now: '2026-03-04T00:00:00.000Z',
      traceId: 'trace_phase250_metrics_daily'
    }, {
      listMetricRows: async () => [{
        dateKey: '2026-03-03',
        cityPackId: 'cp_daily_001',
        slotId: 'slot_daily_001',
        sourceRefId: 'sr_daily_001',
        sentCount: 10,
        deliveredCount: 8,
        clickCount: 2,
        readCount: 1,
        failedCount: 1
      }],
      listNotificationDeliveriesBySentAtRange: async () => {
        rangeCalls += 1;
        return [];
      },
      listAllNotificationDeliveries: async () => [],
      getNotification: async () => null,
      getSourceRef: async () => null
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.dataSource, 'city_pack_metrics_daily');
    assert.ok(Number.isFinite(result.readLimitUsed));
    assert.ok(result.readLimitUsed <= 2000);
    assert.ok(Array.isArray(result.dailyRows));
    assert.ok(Array.isArray(result.items));
    assert.ok(result.summary && typeof result.summary === 'object');
    assert.strictEqual(rangeCalls, 0);
  } finally {
    if (prevBounded === undefined) delete process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1;
    else process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1 = prevBounded;
    if (prevDailyPreferred === undefined) delete process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1;
    else process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1 = prevDailyPreferred;
    if (prevLimitMax === undefined) delete process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX;
    else process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX = prevLimitMax;
  }
});

test('phase250: metrics falls back to bounded all-deliveries when range query fails', async () => {
  const prevBounded = process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1;
  const prevDailyPreferred = process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1;
  const prevLimitMax = process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX;
  process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1 = '1';
  process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1 = '1';
  process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX = '150';

  try {
    let fallbackLimit = null;
    const result = await computeCityPackMetrics({
      windowDays: 30,
      limit: 200,
      now: '2026-03-04T00:00:00.000Z',
      traceId: 'trace_phase250_metrics_fallback'
    }, {
      listMetricRows: async () => [],
      listNotificationDeliveriesBySentAtRange: async () => {
        throw new Error('range_failed');
      },
      listAllNotificationDeliveries: async (opts) => {
        fallbackLimit = opts && opts.limit;
        return [{
          id: 'd_phase250_001',
          data: {
            notificationId: 'n_phase250_001',
            sentAt: '2026-03-03T12:00:00.000Z',
            delivered: true,
            deliveredAt: '2026-03-03T12:00:00.000Z',
            clickAt: '2026-03-03T12:10:00.000Z'
          }
        }];
      },
      getNotification: async () => ({
        sourceRefs: ['sr_phase250_001'],
        notificationMeta: { slotId: 'slot_phase250' }
      }),
      getSourceRef: async () => ({
        usedByCityPackIds: ['cp_phase250_001']
      })
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.dataSource, 'notification_deliveries_all_fallback');
    assert.strictEqual(result.readLimitUsed, 150);
    assert.strictEqual(fallbackLimit, 150);
    assert.ok(Array.isArray(result.items));
    assert.ok(result.items.some((item) => item.cityPackId === 'cp_phase250_001'));
  } finally {
    if (prevBounded === undefined) delete process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1;
    else process.env.ENABLE_CITY_PACK_METRICS_BOUNDED_V1 = prevBounded;
    if (prevDailyPreferred === undefined) delete process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1;
    else process.env.ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1 = prevDailyPreferred;
    if (prevLimitMax === undefined) delete process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX;
    else process.env.CITY_PACK_METRICS_DELIVERY_LIMIT_MAX = prevLimitMax;
  }
});
