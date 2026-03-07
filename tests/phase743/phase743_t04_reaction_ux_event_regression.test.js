'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { markDeliveryReactionV2 } = require('../../src/usecases/phase37/markDeliveryReactionV2');

test('phase743: markDeliveryReactionV2 appends reaction_received ux_event without responseText', async () => {
  let uxPayload = null;

  const result = await markDeliveryReactionV2({
    deliveryId: 'd743_r1',
    action: 'response',
    responseText: 'secret text',
    lineUserId: 'U743_R1',
    todoKey: 'TODO_743',
    traceId: 'trace743',
    requestId: 'req743'
  }, {
    deliveriesRepo: {
      async markReactionV2(deliveryId) {
        return { id: deliveryId, lineUserId: 'U743_R1', todoKey: 'TODO_743' };
      }
    },
    auditLogsRepo: {
      async appendAuditLog() { return { id: 'a743' }; }
    },
    eventsRepo: {
      async createEvent() { return { id: 'e743' }; }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return { lineUserId: 'U743_R1', todoKey: 'TODO_743' };
      },
      async upsertJourneyTodoItem() { return { ok: true }; }
    },
    appendUxEvent: async (payload) => {
      uxPayload = payload;
      return { ok: true };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(uxPayload.eventType, 'reaction_received');
  assert.equal(uxPayload.deliveryId, 'd743_r1');
  assert.equal(uxPayload.action, 'response');
  assert.equal(uxPayload.lineUserId, 'U743_R1');
  assert.equal(Object.prototype.hasOwnProperty.call(uxPayload, 'responseText'), false);
});

test('phase743: markDeliveryReactionV2 continues when appendUxEvent fails (best-effort)', async () => {
  const result = await markDeliveryReactionV2({
    deliveryId: 'd743_r2',
    action: 'open',
    lineUserId: 'U743_R2',
    todoKey: 'TODO_743_2'
  }, {
    deliveriesRepo: {
      async markReactionV2(deliveryId) {
        return { id: deliveryId, lineUserId: 'U743_R2', todoKey: 'TODO_743_2' };
      }
    },
    auditLogsRepo: {
      async appendAuditLog() { return { id: 'a743_2' }; }
    },
    eventsRepo: {
      async createEvent() { return { id: 'e743_2' }; }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return { lineUserId: 'U743_R2', todoKey: 'TODO_743_2' };
      },
      async upsertJourneyTodoItem() { return { ok: true }; }
    },
    appendUxEvent: async () => {
      throw new Error('ux events down');
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, 'open');
});
