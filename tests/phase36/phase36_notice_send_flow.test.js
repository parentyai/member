'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { sendNotice } = require('../../src/usecases/phase36/sendNotice');

test('phase36: notice send flow pushes and records delivery/audit', async () => {
  let pushed = null;
  let deliveryPayload = null;
  let auditPayload = null;
  const deps = {
    noticesRepo: {
      getNotice: async () => ({ id: 'n1', title: 'Hello', body: 'World', status: 'active' })
    },
    deliveriesRepo: {
      createDelivery: async (payload) => {
        deliveryPayload = payload;
        return { id: 'd1' };
      }
    },
    auditLogsRepo: {
      appendAuditLog: async (payload) => {
        auditPayload = payload;
        return { id: 'a1' };
      }
    },
    pushMessage: async (lineUserId, message) => {
      pushed = { lineUserId, message };
    }
  };

  const result = await sendNotice({ lineUserId: 'U1', noticeId: 'n1', decidedBy: 'ops' }, deps);

  assert.strictEqual(result.ok, true);
  assert.ok(pushed);
  assert.strictEqual(pushed.lineUserId, 'U1');
  assert.strictEqual(deliveryPayload.noticeId, 'n1');
  assert.strictEqual(auditPayload.type, 'NOTICE_SENT');
});
