'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { filterWebhookEvents } = require('../../src/v1/channel_edge/line/receiver');
const { InMemoryWebhookDedupeStore } = require('../../src/v1/channel_edge/line/dedupeStore');

test('phase760: dedupe/redelivery/ordering guards drop duplicates and old events', () => {
  const store = new InMemoryWebhookDedupeStore(100000);
  const events = [
    { webhookEventId: 'e1', timestamp: 2000, source: { type: 'user', userId: 'u1' }, type: 'message' },
    { webhookEventId: 'e1', timestamp: 2001, source: { type: 'user', userId: 'u1' }, type: 'message', deliveryContext: { isRedelivery: true } },
    { webhookEventId: 'e2', timestamp: 1000, source: { type: 'user', userId: 'u1' }, type: 'message' }
  ];
  const first = filterWebhookEvents([events[0]], { dedupeStore: store, skewToleranceMs: 100 });
  const second = filterWebhookEvents([events[1], events[2]], { dedupeStore: store, skewToleranceMs: 100 });
  assert.equal(first.accepted.length, 1);
  assert.equal(second.accepted.length, 0);
  assert.ok(second.dropped.length >= 2);
});
