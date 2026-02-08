'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsoleView } = require('../../src/usecases/phase42/getOpsConsoleView');

test('phase42: ops console view returns read-only payload', async () => {
  const deps = {
    getOpsConsole: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      allowedNextActions: ['NO_ACTION'],
      readiness: { status: 'READY', blocking: [] }
    }),
    getOpsAssistContext: async () => ({
      decisionTimeline: [{ id: 't1', action: 'DECIDE' }]
    }),
    getOpsAssistSuggestion: async () => ({
      suggestionText: '',
      confidence: 'LOW',
      basedOn: ['constraints'],
      riskFlags: [],
      disclaimer: 'This is advisory only'
    })
  };

  const result = await getOpsConsoleView({ lineUserId: 'U1' }, deps);
  assert.ok(result.user);
  assert.ok(result.opsState);
  assert.ok(Array.isArray(result.decisionTimeline));
  assert.ok(result.llmSuggestion);
  assert.ok(Array.isArray(result.allowedNextActions));
  assert.ok(result.readiness);
});
