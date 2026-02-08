'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase39/getOpsAssistSuggestion');

test('phase39: suggestion schema and audit are fixed', async () => {
  let auditPayload = null;
  const deps = {
    deliveriesRepo: {
      listDeliveriesByUser: async () => ([{ id: 'd1', noticeId: 'n1' }])
    },
    auditLogsRepo: {
      appendAuditLog: async (payload) => {
        auditPayload = payload;
        return { id: 'a1' };
      }
    }
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1' }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.suggestion.action, 'SEND_REMINDER');
  assert.strictEqual(auditPayload.type, 'OPS_ASSIST_SUGGESTION');
});
