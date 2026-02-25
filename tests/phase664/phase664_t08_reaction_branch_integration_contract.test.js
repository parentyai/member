'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { markDeliveryReactionV2 } = require('../../src/usecases/phase37/markDeliveryReactionV2');

test('phase664: reaction-v2 keeps existing write path and appends branch outcome evidence', async () => {
  const calls = {
    audits: [],
    events: [],
    deliveryBranchPatch: null
  };

  const result = await markDeliveryReactionV2({
    deliveryId: 'd664_1',
    action: 'save',
    lineUserId: 'U664',
    todoKey: 'P2-ADDR-002',
    traceId: 'trace664_1',
    requestId: 'req664_1'
  }, {
    deliveriesRepo: {
      async markReactionV2(deliveryId, action) {
        return {
          id: deliveryId,
          lineUserId: 'U664',
          todoKey: 'P2-ADDR-002',
          action
        };
      },
      async patchDeliveryBranchOutcome(deliveryId, patch) {
        calls.deliveryBranchPatch = { deliveryId, patch };
        return { id: deliveryId };
      }
    },
    auditLogsRepo: {
      async appendAuditLog(payload) {
        calls.audits.push(payload);
      }
    },
    eventsRepo: {
      async createEvent(payload) {
        calls.events.push(payload);
      }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return { lineUserId: 'U664', todoKey: 'P2-ADDR-002', status: 'open' };
      },
      async upsertJourneyTodoItem() {
        return { ok: true };
      }
    },
    applyJourneyReactionBranch: async () => ({
      ok: true,
      enabled: true,
      reason: 'applied',
      matchedRules: ['rule_save_followup'],
      queuedCount: 1
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.branch.enabled, true);
  assert.equal(result.branch.queuedCount, 1);
  assert.deepEqual(result.branch.matchedRules, ['rule_save_followup']);
  assert.ok(calls.deliveryBranchPatch, 'delivery branch patch should be recorded');
  assert.equal(calls.deliveryBranchPatch.patch.branchRuleId, 'rule_save_followup');
  assert.equal(calls.deliveryBranchPatch.patch.branchDispatchStatus, 'queued');
  assert.ok(calls.audits.some((entry) => entry && entry.action === 'DELIVERY_REACTION_V2'));
  assert.ok(calls.audits.some((entry) => entry && entry.action === 'DELIVERY_REACTION_BRANCH'));
  assert.ok(calls.events.some((entry) => entry && entry.type === 'journey_reaction'));
});
