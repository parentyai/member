'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

const baseView = {
  readiness: { status: 'READY', blocking: [] },
  opsState: { nextAction: 'NO_ACTION' },
  latestDecisionLog: { id: 'd1', nextAction: 'NO_ACTION' },
  userStateSummary: { registrationCompleteness: { ok: true } },
  memberSummary: { member: { hasMemberNumber: true, memberNumberStale: false } },
  allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE']
};

test('phase101: ops assist suggestion includes suggestion/evidence/safety', async () => {
  const deps = {
    getOpsAssistContext: async () => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE'] },
      opsConsoleSnapshot: baseView
    }),
    opsAssistCacheRepo: {
      getLatestOpsAssistCache: async () => null
    },
    decisionTimelineRepo: null,
    appendLlmSuggestionAudit: async () => ({ id: 'a1' })
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView: baseView }, deps);
  assert.ok(result.suggestion);
  assert.ok(result.suggestion.recommendedNextAction);
  assert.ok(result.evidence);
  assert.ok(result.safety);
});
