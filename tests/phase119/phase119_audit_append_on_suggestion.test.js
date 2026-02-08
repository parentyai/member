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

test('phase119: audit append on suggestion includes notificationId', async () => {
  let captured = null;
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
    appendLlmSuggestionAudit: async (payload) => {
      captured = payload;
      return { id: 'a1' };
    }
  };

  await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView: baseView }, deps);
  assert.ok(captured);
  assert.strictEqual(captured.notificationId, 'n1');
  assert.ok(captured.suggestion);
  assert.ok(captured.suggestion.action);
});
