'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const opsStatesRepo = require('../../src/repos/firestore/opsStatesRepo');
const decisionLogsRepo = require('../../src/repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../src/repos/firestore/decisionTimelineRepo');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');
const { getOpsAssistContext } = require('../../src/usecases/phase38/getOpsAssistContext');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase36-39: full ops flow yields timeline + traceability', async () => {
  const notificationId = 'n1';
  const depsSubmit = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE'],
      recommendedNextAction: 'NO_ACTION',
      serverTime: '2026-02-08T00:00:00.000Z',
      closeDecision: 'NO_CLOSE',
      closeReason: 'readiness_not_ready',
      phaseResult: 'READY',
      consistency: { status: 'OK', issues: [] },
      opsState: null,
      latestDecisionLog: null
    }),
    decisionTimelineRepo
  };

  const submitResult = await submitOpsDecision({
    lineUserId: 'U1',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
    decidedBy: 'ops',
    dryRun: false,
    notificationId
  }, depsSubmit);

  const depsExec = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION'],
      opsState: await opsStatesRepo.getOpsState('U1')
    }),
    decisionTimelineRepo,
    nowFn: () => new Date('2026-02-08T01:00:00Z')
  };

  const execResult = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: submitResult.decisionLogId,
    action: 'NO_ACTION'
  }, depsExec);

  assert.strictEqual(execResult.ok, true);

  const depsContext = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: await opsStatesRepo.getOpsState('U1')
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo,
    decisionTimelineRepo
  };

  const context = await getOpsAssistContext({ lineUserId: 'U1', notificationId }, depsContext);
  assert.ok(context.notificationSummary.decisionTrace.lastDecisionLogId);
  assert.strictEqual(context.notificationSummary.decisionTrace.lastExecutionResult, 'OK');
  assert.ok(context.decisionTimeline.length >= 2);
});
