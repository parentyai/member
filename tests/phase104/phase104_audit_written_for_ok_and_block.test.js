'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { appendLlmSuggestionAudit } = require('../../src/usecases/phase104/appendLlmSuggestionAudit');

test('phase104: audit written for ok and block', async () => {
  const captured = [];
  const deps = {
    auditLogsRepo: {
      appendAuditLog: async (entry) => {
        captured.push(entry);
        return { id: `a${captured.length}` };
      }
    }
  };

  await appendLlmSuggestionAudit({
    lineUserId: 'U1',
    inputHash: 'h1',
    suggestion: { nextAction: 'NO_ACTION' },
    safety: { status: 'OK', reasons: [] }
  }, deps);

  await appendLlmSuggestionAudit({
    lineUserId: 'U2',
    inputHash: 'h2',
    suggestion: { nextAction: 'STOP_AND_ESCALATE' },
    safety: { status: 'BLOCK', reasons: ['action_not_allowed'] }
  }, deps);

  assert.strictEqual(captured.length, 2);
  assert.strictEqual(captured[0].eventType, 'LLM_SUGGESTION');
  assert.strictEqual(captured[1].eventType, 'LLM_SUGGESTION');
});
