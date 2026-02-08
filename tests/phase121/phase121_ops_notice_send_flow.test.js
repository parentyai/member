'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { sendOpsNotice } = require('../../src/usecases/phase121/sendOpsNotice');

test('phase121: ops notice send flow writes delivery and audit', async () => {
  let pushed = null;
  let deliveryPayload = null;
  let auditPayload = null;
  const deps = {
    getKillSwitch: async () => false,
    pushMessage: async (lineUserId, message) => {
      pushed = { lineUserId, message };
    },
    deliveriesRepo: {
      createDelivery: async (payload) => {
        deliveryPayload = payload;
        return { id: 'del1' };
      }
    },
    auditLogsRepo: {
      appendAuditLog: async (payload) => {
        auditPayload = payload;
        return { id: 'a1' };
      }
    }
  };

  const result = await sendOpsNotice({
    lineUserId: 'U1',
    text: 'hello',
    sourceNotificationId: 'n1',
    decidedBy: 'ops'
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.ok(pushed);
  assert.strictEqual(deliveryPayload.notificationId, 'n1');
  assert.strictEqual(auditPayload.type, 'OPS_NOTICE_SENT');
});
