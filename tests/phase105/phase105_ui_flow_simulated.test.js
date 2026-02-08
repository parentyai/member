'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { appendLlmAdoptAudit } = require('../../src/usecases/phase105/appendLlmAdoptAudit');

test('phase105: adopt audit appended', async () => {
  let captured = null;
  const deps = {
    auditLogsRepo: {
      appendAuditLog: async (entry) => {
        captured = entry;
        return { id: 'a1' };
      }
    }
  };

  await appendLlmAdoptAudit({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    adoptedAction: 'NO_ACTION',
    suggestion: { nextAction: 'NO_ACTION' }
  }, deps);

  assert.ok(captured);
  assert.strictEqual(captured.eventType, 'LLM_SUGGESTION_ADOPTED');
  assert.strictEqual(captured.adoptedAction, 'NO_ACTION');
});
