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

test('phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect)', async () => {
  const decision = await decisionLogsRepo.appendDecision({
    subjectType: 'user',
    subjectId: 'U1',
    decision: 'ESCALATE',
    nextAction: 'STOP_AND_ESCALATE',
    decidedBy: 'ops',
    reason: 'test',
    traceId: 'TRACE_DECIDE',
    requestId: 'REQ_DECIDE',
    audit: { traceId: 'TRACE_DECIDE', requestId: 'REQ_DECIDE', notificationId: 'n1' }
  });

  const result = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: decision.id,
    action: 'STOP_AND_ESCALATE',
    actor: 'ops_readonly'
  }, {
    getKillSwitch: async () => true,
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      opsState: { failure_class: 'UNKNOWN', reasonCode: null, stage: null, note: '' }
    }),
    notifyEscalation: async () => {
      throw new Error('must not send when kill switch ON');
    }
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(result.killSwitch, true);
  assert.ok(String(result.error).includes('kill_switch'));

  const auditDocs = db._state.collections.audit_logs ? Object.values(db._state.collections.audit_logs.docs) : [];
  const executeAudits = auditDocs.filter((doc) => doc.data && doc.data.action === 'ops_decision.execute');
  assert.strictEqual(executeAudits.length, 1);
  assert.strictEqual(executeAudits[0].data.traceId, 'TRACE_DECIDE');
  assert.strictEqual(executeAudits[0].data.payloadSummary.blockedByKillSwitch, true);
});

