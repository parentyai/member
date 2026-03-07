'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { markDeliveryReactionV2 } = require('../../src/usecases/phase37/markDeliveryReactionV2');

test('phase742: reaction-v2 appends ux_event reaction_received when uxos events flag is enabled', async () => {
  const prev = process.env.ENABLE_UXOS_EVENTS;
  process.env.ENABLE_UXOS_EVENTS = '1';
  const eventCalls = [];
  try {
    const result = await markDeliveryReactionV2({
      deliveryId: 'd742_reaction',
      action: 'open',
      lineUserId: 'U742',
      todoKey: 'todo_742',
      traceId: 'trace742_rx',
      requestId: 'req742_rx'
    }, {
      deliveriesRepo: {
        async markReactionV2() {
          return {
            id: 'd742_reaction',
            lineUserId: 'U742',
            todoKey: 'todo_742',
            notificationId: 'n742_reaction'
          };
        }
      },
      auditLogsRepo: {
        async appendAuditLog() {
          return { id: 'audit742' };
        }
      },
      eventsRepo: {
        async createEvent(payload) {
          eventCalls.push(payload);
          return { id: `e742_${eventCalls.length}` };
        }
      },
      journeyTodoItemsRepo: {
        async getJourneyTodoItem() {
          return {
            lineUserId: 'U742',
            todoKey: 'todo_742',
            journeyState: 'planned'
          };
        },
        async upsertJourneyTodoItem() {
          return { ok: true };
        }
      }
    });

    assert.equal(result.ok, true);
    assert.equal(eventCalls.length, 2);
    assert.ok(eventCalls.some((row) => row.type === 'journey_reaction'));
    const uxEvent = eventCalls.find((row) => row.type === 'ux_event');
    assert.ok(uxEvent);
    assert.equal(uxEvent.uxEventType, 'reaction_received');
    assert.equal(uxEvent.lineUserId, 'U742');
    assert.equal(uxEvent.ref.notificationId, 'n742_reaction');
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_EVENTS;
    else process.env.ENABLE_UXOS_EVENTS = prev;
  }
});
