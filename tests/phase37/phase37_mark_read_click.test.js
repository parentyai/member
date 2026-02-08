'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { markDeliveryReaction } = require('../../src/usecases/phase37/markDeliveryReaction');

test('phase37: mark read and click append audit logs', async () => {
  let readId = null;
  let clickId = null;
  const auditPayloads = [];
  const deps = {
    deliveriesRepo: {
      markRead: async (deliveryId) => { readId = deliveryId; },
      markClick: async (deliveryId) => { clickId = deliveryId; }
    },
    auditLogsRepo: {
      appendAuditLog: async (payload) => {
        auditPayloads.push(payload);
        return { id: `a${auditPayloads.length}` };
      }
    }
  };

  const readResult = await markDeliveryReaction({ deliveryId: 'd1', action: 'read' }, deps);
  const clickResult = await markDeliveryReaction({ deliveryId: 'd2', action: 'click' }, deps);

  assert.strictEqual(readResult.ok, true);
  assert.strictEqual(clickResult.ok, true);
  assert.strictEqual(readId, 'd1');
  assert.strictEqual(clickId, 'd2');
  assert.strictEqual(auditPayloads[0].type, 'DELIVERY_READ');
  assert.strictEqual(auditPayloads[1].type, 'DELIVERY_CLICK');
});
