'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

const baseView = {
  readiness: { status: 'READY', blocking: [] },
  opsState: { nextAction: 'NO_ACTION' },
  latestDecisionLog: { id: 'd1', nextAction: 'NO_ACTION', audit: { notificationId: 'n1' } },
  userStateSummary: { registrationCompleteness: { ok: true } },
  memberSummary: { member: { hasMemberNumber: true, memberNumberStale: false } },
  allowedNextActions: ['NO_ACTION']
};

test('phase118: suggestion schema is fixed', async () => {
  const deps = {
    getKillSwitch: async () => false,
    getOpsAssistContext: async () => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] },
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
  assert.ok(['NO_ACTION', 'SEND_NOTICE', 'SEND_REMINDER'].includes(result.suggestion.action));
  assert.ok(result.suggestion.reason);
  assert.ok(result.suggestion.evidence);
  assert.ok(result.suggestion.safety);
});
