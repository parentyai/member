'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

test('phase51: input hash change triggers refresh', async () => {
  const opsConsoleView = {
    readiness: { status: 'READY', blocking: [] },
    opsState: { nextAction: 'NO_ACTION' },
    latestDecisionLog: null,
    userStateSummary: { lineUserId: 'U1' },
    memberSummary: { lineUserId: 'U1' },
    allowedNextActions: ['NO_ACTION']
  };

  let buildCalled = false;
  const deps = {
    getOpsAssistContext: async () => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] },
      opsConsoleSnapshot: opsConsoleView
    }),
    opsAssistCacheRepo: {
      getLatestOpsAssistCache: async () => ({
        lineUserId: 'U1',
        snapshot: {
          suggestionText: 'OLD',
          confidence: 'LOW',
          basedOn: ['constraints'],
          riskFlags: [],
          disclaimer: 'This is advisory only',
          suggestion: { nextAction: 'STOP_AND_ESCALATE', reason: 'old' },
          model: 'ops-assist-rules'
        },
        inputHash: 'old-hash',
        expiresAt: '2026-02-08T01:00:00Z'
      }),
      appendOpsAssistCache: async () => ({ id: 'c1' })
    },
    buildSuggestion: () => {
      buildCalled = true;
      return {
        suggestionText: 'NO_ACTION: refreshed',
        confidence: 'LOW',
        basedOn: ['constraints'],
        riskFlags: [],
        disclaimer: 'This is advisory only',
        suggestion: { nextAction: 'NO_ACTION', reason: 'refreshed' },
        model: 'ops-assist-rules'
      };
    },
    nowMs: new Date('2026-02-08T00:00:00Z').getTime()
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView }, deps);
  assert.ok(buildCalled);
  assert.strictEqual(result.suggestion.nextAction, 'NO_ACTION');
});
