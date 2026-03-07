'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { appendUxEvent } = require('../../src/usecases/observability/appendUxEvent');

test('phase743: appendUxEvent does not write when flag is disabled', async () => {
  const previous = process.env.ENABLE_UXOS_EVENTS_V1;
  delete process.env.ENABLE_UXOS_EVENTS_V1;
  let calls = 0;
  try {
    const result = await appendUxEvent({
      eventType: 'notification_sent',
      deliveryId: 'd743_u1'
    }, {
      uxEventsRepo: {
        async appendUxEvent() {
          calls += 1;
          return { id: 'notification_sent__d743_u1' };
        }
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.disabled, true);
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_EVENTS_V1;
    else process.env.ENABLE_UXOS_EVENTS_V1 = previous;
  }
});

test('phase743: appendUxEvent forwards payload when flag is enabled', async () => {
  const previous = process.env.ENABLE_UXOS_EVENTS_V1;
  process.env.ENABLE_UXOS_EVENTS_V1 = '1';
  let received = null;
  try {
    const result = await appendUxEvent({
      eventType: 'reaction_received',
      deliveryId: 'd743_u2',
      action: 'open'
    }, {
      uxEventsRepo: {
        async appendUxEvent(payload) {
          received = payload;
          return {
            id: 'reaction_received__d743_u2__open',
            eventType: 'reaction_received',
            deliveryId: 'd743_u2',
            idempotent: false
          };
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.disabled, false);
    assert.equal(result.id, 'reaction_received__d743_u2__open');
    assert.equal(result.eventType, 'reaction_received');
    assert.equal(result.deliveryId, 'd743_u2');
    assert.equal(received.eventType, 'reaction_received');
  } finally {
    if (previous === undefined) delete process.env.ENABLE_UXOS_EVENTS_V1;
    else process.env.ENABLE_UXOS_EVENTS_V1 = previous;
  }
});
