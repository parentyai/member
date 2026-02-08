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

const decisionLogsRepo = require('../../src/repos/firestore/decisionLogsRepo');
const opsStatesRepo = require('../../src/repos/firestore/opsStatesRepo');
const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase35 t03: ops loop updates executionStatus', async () => {
  const baseDeps = {
    getUserStateSummary: async ({ lineUserId }) => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: await opsStatesRepo.getOpsState(lineUserId)
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo,
    opsStatesRepo
  };

  const consoleStart = await getOpsConsole({ lineUserId: 'U1' }, baseDeps);
  assert.strictEqual(consoleStart.executionStatus.lastExecutionResult, 'UNKNOWN');

  const submitResult = await submitOpsDecision({
    lineUserId: 'U1',
    decision: {
      nextAction: 'STOP_AND_ESCALATE',
      failure_class: 'IMPL',
      reasonCode: 'RC1',
      stage: 'ST1',
      note: 'note'
    },
    decidedBy: 'ops',
    dryRun: false
  }, {
    getOpsConsole: async () => ({
      readiness: { status: 'NOT_READY', blocking: ['missing_summary'] },
      allowedNextActions: ['STOP_AND_ESCALATE'],
      recommendedNextAction: 'STOP_AND_ESCALATE',
      closeDecision: 'NO_CLOSE',
      closeReason: 'readiness_not_ready',
      phaseResult: 'NOT_READY',
      consistency: { status: 'OK', issues: [] }
    })
  });

  const execResult = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: submitResult.decisionLogId,
    action: 'STOP_AND_ESCALATE'
  }, Object.assign({}, baseDeps, {
    getOpsConsole,
    nowFn: () => new Date('2026-02-08T01:00:00Z'),
    notifyEscalation: async () => ({ ok: true, sideEffects: ['notification_sent'] })
  }));

  assert.strictEqual(execResult.ok, true);

  const consoleEnd = await getOpsConsole({ lineUserId: 'U1' }, baseDeps);
  assert.strictEqual(consoleEnd.executionStatus.lastExecutionResult, 'OK');
  assert.strictEqual(consoleEnd.executionStatus.lastExecutedAt, '2026-02-08T01:00:00.000Z');
  assert.strictEqual(consoleEnd.executionStatus.lastFailureClass, 'IMPL');
  assert.strictEqual(consoleEnd.executionStatus.lastReasonCode, 'RC1');
  assert.strictEqual(consoleEnd.executionStatus.lastStage, 'ST1');
  assert.strictEqual(consoleEnd.executionStatus.lastNote, 'note');
});
