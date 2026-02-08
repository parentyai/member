'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { executeAutomationDecision } = require('../../src/usecases/phase43/executeAutomationDecision');

test('phase50: obs emitted on submit and execute', async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (msg) => logs.push(String(msg));
  try {
    await submitOpsDecision({
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

    await executeAutomationDecision({
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
  } finally {
    console.log = originalLog;
  }

  const obsLines = logs.filter((line) => line.startsWith('[OBS]'));
  assert.ok(obsLines.some((line) => line.includes('action=ops_decision_submit')));
  assert.ok(obsLines.some((line) => line.includes('action=automation_execute')));
});
