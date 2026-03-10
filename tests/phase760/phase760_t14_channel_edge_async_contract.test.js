'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { filterWebhookEventsAsync } = require('../../src/v1/channel_edge/line/receiver');

test('phase760: async channel edge filter supports durable dedupe/redelivery/ordering semantics', async () => {
  const seen = new Set();
  const ordering = new Map();
  const dedupeStore = {
    async isSeen(key) {
      return seen.has(key);
    },
    async markSeen(key) {
      seen.add(key);
    }
  };
  const orderingStore = {
    async shouldDropByOrdering(event, options) {
      const skewToleranceMs = Number.isFinite(Number(options && options.skewToleranceMs))
        ? Number(options.skewToleranceMs)
        : 20_000;
      const source = event && event.source && typeof event.source === 'object' ? event.source : {};
      const sourceKey = `${source.type || 'unknown'}:${source.userId || source.groupId || source.roomId || 'unknown'}`;
      const timestamp = Number.isFinite(Number(event && event.timestamp)) ? Number(event.timestamp) : 0;
      const latest = ordering.get(sourceKey) || 0;
      if (timestamp && timestamp + skewToleranceMs < latest) return true;
      if (timestamp > latest) ordering.set(sourceKey, timestamp);
      return false;
    }
  };

  const events = [
    { webhookEventId: 'e1', timestamp: 2000, source: { type: 'user', userId: 'u1' }, type: 'message' },
    { webhookEventId: 'e1', timestamp: 2001, source: { type: 'user', userId: 'u1' }, type: 'message', deliveryContext: { isRedelivery: true } },
    { webhookEventId: 'e2', timestamp: 1000, source: { type: 'user', userId: 'u1' }, type: 'message' }
  ];

  const first = await filterWebhookEventsAsync([events[0]], { dedupeStore, orderingStore, skewToleranceMs: 100 });
  const second = await filterWebhookEventsAsync([events[1], events[2]], { dedupeStore, orderingStore, skewToleranceMs: 100 });

  assert.equal(first.accepted.length, 1);
  assert.equal(second.accepted.length, 0);
  assert.equal(second.dropped.length, 2);
  const reasons = second.dropped.map((row) => row.reason).sort();
  assert.deepEqual(reasons, ['duplicate_event', 'out_of_order']);
});

