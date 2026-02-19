'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { computeCityPackMetrics } = require('../../src/usecases/cityPack/computeCityPackMetrics');

test('phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback', async () => {
  const now = '2026-02-19T00:00:00.000Z';
  const data = await computeCityPackMetrics({
    windowDays: 7,
    limit: 50,
    now,
    traceId: 'trace_phase273_usecase'
  }, {
    listAllNotificationDeliveries: async () => [
      {
        id: 'd1',
        data: {
          notificationId: 'n1',
          sentAt: '2026-02-18T10:00:00.000Z',
          deliveredAt: '2026-02-18T10:00:00.000Z',
          delivered: true,
          clickAt: '2026-02-18T10:05:00.000Z',
          readAt: '2026-02-18T10:02:00.000Z'
        }
      },
      {
        id: 'd2',
        data: {
          notificationId: 'n1',
          sentAt: '2026-02-18T11:00:00.000Z',
          deliveredAt: '2026-02-18T11:00:00.000Z',
          delivered: true
        }
      }
    ],
    getNotification: async (id) => ({
      id,
      sourceRefs: ['sr_required', 'sr_optional'],
      notificationMeta: { slotId: 'slot_a' }
    }),
    getSourceRef: async (id) => {
      if (id === 'sr_required') return { id, usedByCityPackIds: ['cp_a'] };
      if (id === 'sr_optional') return { id, usedByCityPackIds: [] };
      return null;
    }
  });

  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.windowDays, 7);
  assert.ok(Array.isArray(data.dailyRows));
  assert.ok(data.dailyRows.length >= 2);
  assert.ok(data.items.some((item) => item.cityPackId === 'cp_a' && item.slotId === 'slot_a' && item.sourceRefId === 'sr_required'));
  assert.ok(data.items.some((item) => item.cityPackId === 'unmapped' && item.sourceRefId === 'sr_optional'));

  const mapped = data.items.find((item) => item.cityPackId === 'cp_a' && item.sourceRefId === 'sr_required');
  assert.ok(mapped);
  assert.strictEqual(mapped.sentCount, 2);
  assert.strictEqual(mapped.deliveredCount, 2);
  assert.strictEqual(mapped.clickCount, 1);
});

