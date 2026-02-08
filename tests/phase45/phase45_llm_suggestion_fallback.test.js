'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

test('phase45: suggestion falls back to allowed action', async () => {
  const deps = {
    getOpsAssistContext: async () => ({
      opsState: { nextAction: 'NO_ACTION' },
      decisionTimeline: [],
      constraints: { readiness: 'NOT_READY', allowedNextActions: ['STOP_AND_ESCALATE'] },
      opsConsoleSnapshot: {
        readiness: { status: 'NOT_READY', blocking: [] },
        opsState: { nextAction: 'NO_ACTION' },
        latestDecisionLog: null,
        userStateSummary: { lineUserId: 'U1' },
        memberSummary: { lineUserId: 'U1' },
        allowedNextActions: ['STOP_AND_ESCALATE']
      }
    }),
    decisionTimelineRepo: { appendTimelineEntry: async () => ({ id: 't1' }) }
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1' }, deps);
  assert.ok(result.suggestion);
  assert.strictEqual(result.suggestion.nextAction, 'STOP_AND_ESCALATE');
  assert.ok(result.suggestion.reason.includes('readiness'));
  assert.ok(result.suggestionText.includes('STOP_AND_ESCALATE'));
  assert.ok(result.promptPayload);
});
