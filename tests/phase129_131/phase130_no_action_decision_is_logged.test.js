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

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

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

test('phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution)', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      recommendedNextAction: 'NO_ACTION',
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      serverTime: '2026-02-09T00:00:00.000Z'
    })
  };

  const result = await submitOpsDecision({
    lineUserId: 'U1',
    traceId: 'TRACE1',
    requestId: 'REQ2',
    actor: 'ops_readonly',
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS', note: 'skip' },
    dryRun: false
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.decisionLogId, typeof result.decisionLogId === 'string' ? result.decisionLogId : null);
  assert.strictEqual(result.audit.readinessStatus, 'READY');
  assert.strictEqual(result.audit.decidedNextAction, 'NO_ACTION');
  assert.strictEqual(result.audit.traceId, 'TRACE1');
  assert.strictEqual(result.audit.requestId, 'REQ2');

  const decisionDoc = db._state.collections.decision_logs.docs[result.decisionLogId];
  assert.ok(decisionDoc);
  assert.strictEqual(decisionDoc.data.subjectType, 'user');
  assert.strictEqual(decisionDoc.data.subjectId, 'U1');
  assert.strictEqual(decisionDoc.data.nextAction, 'NO_ACTION');
  assert.strictEqual(decisionDoc.data.traceId, 'TRACE1');
  assert.strictEqual(decisionDoc.data.requestId, 'REQ2');
  assert.strictEqual(decisionDoc.data.audit.decidedNextAction, 'NO_ACTION');

  const auditDocs = db._state.collections.audit_logs ? Object.values(db._state.collections.audit_logs.docs) : [];
  const submitAudits = auditDocs.filter((doc) => doc.data && doc.data.action === 'ops_decision.submit');
  assert.strictEqual(submitAudits.length, 1);
  assert.strictEqual(submitAudits[0].data.traceId, 'TRACE1');

  // NO_ACTION is a decision; it must not create an ops_execution decision log by itself.
  const allDecisionDocs = Object.values(db._state.collections.decision_logs.docs).map((doc) => doc.data);
  assert.strictEqual(allDecisionDocs.some((doc) => doc.subjectType === 'ops_execution'), false);
});

