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

test('phase106: llm disabled by default falls back to rules', async () => {
  let called = false;
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
    appendLlmSuggestionAudit: async () => ({ id: 'a1' }),
    llmAdapter: {
      suggest: async () => {
        called = true;
        return { suggestionText: 'bad' };
      }
    }
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView: baseView }, deps);
  assert.strictEqual(called, false);
  assert.strictEqual(result.model, 'ops-assist-rules');
  assert.ok(Array.isArray(result.riskFlags));
  assert.ok(result.riskFlags.includes('llm_disabled_default'));
});
