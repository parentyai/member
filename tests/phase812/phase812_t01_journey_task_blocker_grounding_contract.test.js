'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { resolveJourneyActionSignals } = require('../../src/domain/llm/quality/resolveJourneyActionSignals');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase812: blocked task with matching next action stays journey-aligned', () => {
  const signals = resolveJourneyActionSignals({
    contextSnapshot: {
      journeyPhase: 'arrival_0_30',
      topTasks: [
        {
          key: 'ssn_application',
          title: 'SSN申請',
          status: 'blocked'
        }
      ]
    },
    nextActions: ['まずは SSN申請 の必要書類を確認する']
  });

  assert.equal(signals.journeyContext, true);
  assert.equal(signals.taskBlockerDetected, true);
  assert.equal(signals.journeyPhase, 'arrival_0_30');
  assert.equal(signals.journeyAlignedAction, true);
});

test('phase812: blocked task with unrelated next action is marked misaligned', () => {
  const signals = resolveJourneyActionSignals({
    contextSnapshot: {
      journeyPhase: 'arrival_0_30',
      topTasks: [
        {
          key: 'school_registration',
          title: '学校登録',
          status: 'locked'
        }
      ]
    },
    nextActions: ['先に銀行口座を開設する']
  });

  assert.equal(signals.journeyContext, true);
  assert.equal(signals.taskBlockerDetected, true);
  assert.equal(signals.journeyAlignedAction, false);
  assert.equal(signals.blockedTask.title, '学校登録');
});

test('phase812: webhook, orchestrator, and concierge wire journey blocker helpers', () => {
  const webhookRoute = read('src/routes/webhookLine.js');
  const orchestrator = read('src/domain/llm/orchestrator/runPaidConversationOrchestrator.js');
  const concierge = read('src/usecases/assistant/concierge/composeConciergeReply.js');

  assert.ok(webhookRoute.includes('resolveJourneyActionSignals'));
  assert.ok(webhookRoute.includes('journeyAlignedAction: journeySignals.journeyAlignedAction !== false'));
  assert.ok(webhookRoute.includes('taskBlockerDetected: journeySignals.taskBlockerDetected'));

  assert.ok(orchestrator.includes('resolveJourneyActionSignals'));
  assert.ok(orchestrator.includes('journeyAlignedAction: journeySignals.journeyAlignedAction !== false'));

  assert.ok(concierge.includes('resolveJourneyActionSignals'));
  assert.ok(concierge.includes('journeyAlignedAction: journeySignals.journeyAlignedAction !== false'));
});
