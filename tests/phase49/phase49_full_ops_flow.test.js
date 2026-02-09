'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');
const { getOpsAssistForConsole } = require('../../src/usecases/phase46/getOpsAssistForConsole');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { dryRunAutomationDecision } = require('../../src/usecases/phase47/dryRunAutomationDecision');
const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase49: full ops flow stays consistent', async () => {
  const consoleSnapshot = {
    readiness: { status: 'READY', blocking: [] },
    allowedNextActions: ['NO_ACTION'],
    recommendedNextAction: 'NO_ACTION',
    opsState: { nextAction: 'NO_ACTION' },
    latestDecisionLog: { id: 'd1' },
    userStateSummary: { lineUserId: 'U1' },
    memberSummary: { lineUserId: 'U1' },
    consistency: { status: 'OK' }
  };

  const listResult = await listOpsConsole({ status: 'ALL', limit: 1 }, {
    listUsers: async () => ([{ id: 'U1' }]),
    getOpsConsole: async () => consoleSnapshot
  });
  assert.strictEqual(listResult.items.length, 1);

  const assistView = await getOpsAssistForConsole({ lineUserId: 'U1' }, {
    getOpsAssistContext: async () => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION'] },
      opsConsoleSnapshot: Object.assign({}, consoleSnapshot, { allowedNextActions: ['NO_ACTION'] }),
      userStateSummary: { lineUserId: 'U1' },
      memberSummary: { lineUserId: 'U1' }
    }),
    getOpsConsoleView: async () => ({
      ok: true,
      lineUserId: 'U1',
      readiness: consoleSnapshot.readiness,
      allowedNextActions: ['NO_ACTION'],
      latestDecisionLog: { id: 'd1' },
      userStateSummary: { lineUserId: 'U1' },
      memberSummary: { lineUserId: 'U1' },
      llmSuggestion: null
    }),
    getOpsAssistSuggestion: async () => ({
      suggestionText: 'NO_ACTION: default',
      confidence: 'LOW',
      basedOn: ['constraints'],
      riskFlags: [],
      disclaimer: 'This is advisory only',
      suggestion: { nextAction: 'NO_ACTION', reason: 'default' }
    }),
    opsAssistCacheRepo: {
      getLatestOpsAssistCache: async () => null,
      appendOpsAssistCache: async () => ({ id: 'c1' })
    }
  });
  assert.ok(assistView.llmSuggestion);

  const submitResult = await submitOpsDecision({
    lineUserId: 'U1',
    decision: {
      nextAction: 'NO_ACTION',
      failure_class: 'PASS',
      reasonCode: null,
      stage: null,
      note: ''
    }
  }, {
    getOpsConsole: async () => ({
      serverTime: '2026-02-08T00:00:00Z',
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION'],
      recommendedNextAction: 'NO_ACTION',
      phaseResult: 'OK',
      closeDecision: 'OPEN',
      closeReason: 'N/A',
      opsState: null,
      latestDecisionLog: null,
      consistency: { status: 'OK' }
    }),
    recordOpsNextAction: async () => ({
      decisionLogId: 'd1',
      opsState: { sourceDecisionLogId: 'd1' }
    }),
    decisionLogsRepo: {
      getDecisionById: async () => ({
        id: 'd1',
        audit: { readinessStatus: 'READY', allowedNextActions: ['NO_ACTION'] }
      })
    },
    decisionTimelineRepo: {
      appendTimelineEntry: async () => ({ id: 't1' })
    }
  });
  assert.strictEqual(submitResult.ok, true);
  assert.strictEqual(submitResult.postCheck.ok, true);

  const dryRun = await dryRunAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    },
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK' },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    })
  });
  assert.strictEqual(dryRun.ok, true);

  const execSkip = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ enabled: false })
    }
  });
  assert.strictEqual(execSkip.ok, false);
  assert.strictEqual(execSkip.reason, 'automation_disabled');

  const execOk = await executeAutomationDecision({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    action: 'NO_ACTION',
    confirmed: true,
    recentDryRun: true,
    nowMs: new Date('2026-02-08T00:00:00Z').getTime(),
    maxOpsStateAgeMs: 60 * 60 * 1000
  }, {
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({
        enabled: true,
        allowedActions: ['NO_ACTION'],
        requireConfirmation: false
      })
    },
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK' },
      opsState: { updatedAt: '2026-02-08T00:00:00Z' }
    }),
    executeOpsNextAction: async () => ({ ok: true, action: 'NO_ACTION' }),
    decisionTimelineRepo: { appendTimelineEntry: async () => ({ id: 't2' }) }
  });
  assert.strictEqual(execOk.ok, false);
  assert.strictEqual(execOk.skipped, true);
  assert.strictEqual(execOk.reason, 'no_action_not_executable');
});
