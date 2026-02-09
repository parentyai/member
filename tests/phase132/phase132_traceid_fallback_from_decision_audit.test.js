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
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase132: execute fills traceId from existing decision audit when payload traceId missing', async () => {
  const decision = await decisionLogsRepo.appendDecision({
    subjectType: 'user',
    subjectId: 'U1',
    decision: 'OK',
    nextAction: 'NO_ACTION',
    decidedBy: 'ops',
    reason: 'test',
    audit: { traceId: 'TRACE1', requestId: 'REQ1', notificationId: 'n1' }
  });

  const result = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: decision.id,
    action: 'NO_ACTION'
    // traceId intentionally omitted
  }, {
    getKillSwitch: async () => false,
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      opsState: { failure_class: 'PASS', reasonCode: null, stage: null, note: '' }
    })
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.traceId, 'TRACE1');

  const allDecisionDocs = Object.values(db._state.collections.decision_logs.docs).map((doc) => doc.data);
  const executions = allDecisionDocs.filter((doc) => doc.subjectType === 'ops_execution' && doc.subjectId === decision.id);
  assert.strictEqual(executions.length, 1);
  assert.strictEqual(executions[0].traceId, 'TRACE1');
  assert.strictEqual(executions[0].audit.traceId, 'TRACE1');
});

