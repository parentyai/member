'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { guardOpsAssistSuggestion } = require('../../src/usecases/phase103/guardOpsAssistSuggestion');

test('phase103: guard blocks invalid suggestion', () => {
  const result = guardOpsAssistSuggestion({
    opsAssistInput: {
      readiness: { status: 'READY' },
      opsState: { nextAction: 'NO_ACTION' },
      constraints: { allowedNextActions: ['STOP_AND_ESCALATE'] }
    },
    suggestedAction: 'NO_ACTION'
  });

  assert.strictEqual(result.status, 'BLOCK');
  assert.ok(result.reasons.includes('action_not_allowed'));
});
