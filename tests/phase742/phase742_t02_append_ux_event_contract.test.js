'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { appendUxEvent } = require('../../src/usecases/uxos/appendUxEvent');

test('phase742: appendUxEvent skips when feature flag is disabled', async () => {
  const prev = process.env.ENABLE_UXOS_EVENTS;
  process.env.ENABLE_UXOS_EVENTS = '0';
  let called = 0;
  try {
    const result = await appendUxEvent({
      lineUserId: 'U742',
      uxEventType: 'reaction_received'
    }, {
      eventsRepo: {
        async createEvent() {
          called += 1;
          return { id: 'e742_skip' };
        }
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'disabled_by_flag');
    assert.equal(called, 0);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_EVENTS;
    else process.env.ENABLE_UXOS_EVENTS = prev;
  }
});

test('phase742: appendUxEvent appends ux_event when feature flag is enabled', async () => {
  const prev = process.env.ENABLE_UXOS_EVENTS;
  process.env.ENABLE_UXOS_EVENTS = '1';
  let received = null;
  try {
    const result = await appendUxEvent({
      lineUserId: 'U742',
      uxEventType: 'notification_sent',
      actor: 'phase742_test',
      traceId: 'trace742',
      ref: { notificationId: 'n742' },
      metrics: { deliveredCount: 1 }
    }, {
      eventsRepo: {
        async createEvent(payload) {
          received = payload;
          return { id: 'e742' };
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.id, 'e742');
    assert.ok(received);
    assert.equal(received.type, 'ux_event');
    assert.equal(received.uxEventType, 'notification_sent');
    assert.equal(received.lineUserId, 'U742');
    assert.equal(received.actor, 'phase742_test');
    assert.equal(received.traceId, 'trace742');
    assert.equal(received.ref.notificationId, 'n742');
    assert.equal(received.metrics.deliveredCount, 1);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_EVENTS;
    else process.env.ENABLE_UXOS_EVENTS = prev;
  }
});
