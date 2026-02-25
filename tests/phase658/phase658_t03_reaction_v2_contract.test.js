'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { markDeliveryReactionV2 } = require('../../src/usecases/phase37/markDeliveryReactionV2');

test('phase658: reaction-v2 validates action and writes audit/event payloads', async () => {
  const calls = {
    delivery: null,
    audit: null,
    event: null,
    todoPatch: null
  };

  const result = await markDeliveryReactionV2({
    deliveryId: 'd658_1',
    action: 'open',
    lineUserId: 'U658',
    todoKey: 'P2-SSN-002',
    traceId: 'trace658',
    requestId: 'req658'
  }, {
    deliveriesRepo: {
      async markReactionV2(deliveryId, action, payload) {
        calls.delivery = { deliveryId, action, payload };
        return { id: deliveryId, lineUserId: 'U658', todoKey: 'P2-SSN-002' };
      }
    },
    auditLogsRepo: {
      async appendAuditLog(payload) {
        calls.audit = payload;
        return { id: 'a658' };
      }
    },
    eventsRepo: {
      async createEvent(payload) {
        calls.event = payload;
        return { id: 'e658' };
      }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return { lineUserId: 'U658', todoKey: 'P2-SSN-002', status: 'open' };
      },
      async upsertJourneyTodoItem(lineUserId, todoKey, patch) {
        calls.todoPatch = { lineUserId, todoKey, patch };
        return { lineUserId, todoKey };
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, 'open');
  assert.equal(result.todoUpdated, true);
  assert.equal(calls.delivery.action, 'open');
  assert.equal(calls.audit.action, 'DELIVERY_REACTION_V2');
  assert.equal(calls.event.type, 'journey_reaction');
  assert.equal(calls.todoPatch.patch.lastSignal, 'open');
  assert.equal(calls.todoPatch.patch.journeyState, 'in_progress');
});

test('phase658: reaction-v2 updates snooze fields when todo exists', async () => {
  let todoPatch = null;
  const nowIso = '2026-02-25T10:00:00.000Z';
  const snoozeUntil = '2026-03-01T10:00:00.000Z';

  const result = await markDeliveryReactionV2({
    deliveryId: 'd658_2',
    action: 'snooze',
    lineUserId: 'U658',
    todoKey: 'P2-ADDR-002',
    at: nowIso,
    snoozeUntil
  }, {
    deliveriesRepo: {
      async markReactionV2(deliveryId, action) {
        return { id: deliveryId, lineUserId: 'U658', todoKey: 'P2-ADDR-002', action };
      }
    },
    auditLogsRepo: {
      async appendAuditLog() { return { id: 'a658_2' }; }
    },
    eventsRepo: {
      async createEvent() { return { id: 'e658_2' }; }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return { lineUserId: 'U658', todoKey: 'P2-ADDR-002', status: 'open' };
      },
      async upsertJourneyTodoItem(lineUserId, todoKey, patch) {
        todoPatch = { lineUserId, todoKey, patch };
        return { lineUserId, todoKey };
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, 'snooze');
  assert.ok(todoPatch);
  assert.equal(todoPatch.patch.snoozeUntil, snoozeUntil);
  assert.equal(todoPatch.patch.journeyState, 'snoozed');
  assert.equal(todoPatch.patch.stateUpdatedAt, nowIso);
});


test('phase658: reaction-v2 rejects unsupported action', async () => {
  await assert.rejects(
    () => markDeliveryReactionV2({ deliveryId: 'd658_3', action: 'click' }, {}),
    /invalid action/
  );
});
