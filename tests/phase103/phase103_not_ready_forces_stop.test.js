'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { guardOpsAssistSuggestion } = require('../../src/usecases/phase103/guardOpsAssistSuggestion');

test('phase103: not ready forces STOP', () => {
  const result = guardOpsAssistSuggestion({
    opsAssistInput: {
      readiness: { status: 'NOT_READY' },
      opsState: { nextAction: 'NO_ACTION' },
      constraints: { allowedNextActions: ['STOP_AND_ESCALATE'] }
    },
    suggestedAction: 'NO_ACTION'
  });

  assert.strictEqual(result.forcedAction, 'STOP_AND_ESCALATE');
  assert.strictEqual(result.status, 'OK');
});
