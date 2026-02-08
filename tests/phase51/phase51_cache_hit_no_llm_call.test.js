'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');
const { buildOpsAssistPrompt } = require('../../src/usecases/phase45/buildOpsAssistPrompt');
const { computeInputHash } = require('../../src/usecases/phase51/shouldRefreshOpsAssist');

test('phase51: cache hit returns cached suggestion without regeneration', async () => {
  const opsConsoleView = {
    readiness: { status: 'READY', blocking: [] },
    opsState: { nextAction: 'NO_ACTION' },
    latestDecisionLog: null,
    userStateSummary: { lineUserId: 'U1' },
    memberSummary: { lineUserId: 'U1' },
    allowedNextActions: ['NO_ACTION']
  };
  const promptPayload = buildOpsAssistPrompt({ opsConsoleView });
  const inputHash = computeInputHash(promptPayload);
  const cachedSuggestion = {
    suggestionText: 'NO_ACTION: cached',
    confidence: 'LOW',
    basedOn: ['constraints'],
    riskFlags: [],
    disclaimer: 'This is advisory only',
    suggestion: { nextAction: 'NO_ACTION', reason: 'cached' },
    model: 'ops-assist-rules'
  };

  const deps = {
    getOpsAssistContext: async () => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] },
      opsConsoleSnapshot: opsConsoleView
    }),
    opsAssistCacheRepo: {
      getLatestOpsAssistCache: async () => ({
        lineUserId: 'U1',
        snapshot: cachedSuggestion,
        inputHash,
        expiresAt: '2026-02-08T01:00:00Z'
      }),
      appendOpsAssistCache: async () => {
        throw new Error('should not write cache');
      }
    },
    buildSuggestion: async () => {
      throw new Error('should not regenerate');
    },
    nowMs: new Date('2026-02-08T00:00:00Z').getTime()
  };

  const result = await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView }, deps);
  assert.strictEqual(result.suggestion.nextAction, 'NO_ACTION');
  assert.strictEqual(result.suggestion.reason, 'cached');
});
