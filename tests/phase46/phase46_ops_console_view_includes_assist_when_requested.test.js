'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsoleView } = require('../../src/usecases/phase42/getOpsConsoleView');

test('phase46: ops console view includes assist only when requested', async () => {
  const deps = {
    getOpsConsole: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      allowedNextActions: ['NO_ACTION'],
      readiness: { status: 'READY', blocking: [] }
    }),
    getOpsAssistContext: async () => ({
      decisionTimeline: []
    }),
    getOpsAssistSuggestion: async () => ({
      suggestionText: 'NO_ACTION: default',
      confidence: 'LOW',
      basedOn: ['constraints'],
      riskFlags: [],
      disclaimer: 'This is advisory only',
      suggestion: { nextAction: 'NO_ACTION', reason: 'default' }
    })
  };

  const withAssist = await getOpsConsoleView({ lineUserId: 'U1', includeAssist: true }, deps);
  assert.ok(withAssist.llmSuggestion);

  const withoutAssist = await getOpsConsoleView({ lineUserId: 'U1', includeAssist: false }, deps);
  assert.strictEqual(withoutAssist.llmSuggestion, null);
});
