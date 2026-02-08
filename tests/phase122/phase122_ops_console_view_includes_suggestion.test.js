'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsoleView } = require('../../src/usecases/phase42/getOpsConsoleView');

test('phase122: ops console view includes suggestion and audit id', async () => {
  const deps = {
    getOpsConsole: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      allowedNextActions: ['NO_ACTION'],
      readiness: { status: 'READY', blocking: [] }
    }),
    getOpsAssistContext: async () => ({ decisionTimeline: [] }),
    getOpsAssistSuggestion: async () => ({
      suggestionSchema: { action: 'NO_ACTION', reason: 'safe', confidence: 'LOW', evidence: { notificationId: null }, safety: { ok: true, notes: [] } },
      suggestionAuditId: 'a1',
      suggestion: { nextAction: 'NO_ACTION' }
    })
  };

  const result = await getOpsConsoleView({ lineUserId: 'U1', includeAssist: true }, deps);
  assert.ok(result.suggestion);
  assert.strictEqual(result.lastSuggestionAuditId, 'a1');
});
