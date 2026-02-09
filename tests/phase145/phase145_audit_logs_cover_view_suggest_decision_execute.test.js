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

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { executeOpsNextAction } = require('../../src/usecases/phase33/executeOpsNextAction');
const { getTraceBundle } = require('../../src/usecases/admin/getTraceBundle');

let db;

beforeEach(() => {
  db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('2026-02-09T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase145: audit logs cover view/suggest/decision/execute via single traceId', async () => {
  const traceId = 'TRACE1';
  const requestId = 'REQ1';

  const depsForView = {
    getUserStateSummary: async () => ({
      lineUserId: 'U1',
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null,
      userSummaryCompleteness: { missing: [] }
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null },
    getNotificationReadModel: async () => ([
      {
        notificationId: 'N_BAD',
        title: 'bad',
        scenarioKey: 's1',
        stepKey: 'st1',
        reactionSummary: { sent: 40, clicked: 1, ctr: 0.025 },
        notificationHealth: 'DANGER',
        lastSentAt: '2026-02-09T00:00:00.000Z'
      }
    ])
  };

  const view = await getOpsConsole({
    lineUserId: 'U1',
    auditView: true,
    actor: 'ops_readonly',
    requestId,
    traceId
  }, depsForView);
  assert.strictEqual(view.ok, true);
  assert.ok(view.mitigationSuggestion);

  const depsForSubmit = {
    getOpsConsole: async () => ({
      serverTime: '2026-02-09T00:00:00.000Z',
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK', issues: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      recommendedNextAction: 'NO_ACTION',
      closeDecision: 'NO_CLOSE',
      closeReason: 'not_closed',
      phaseResult: null,
      mitigationSuggestion: view.mitigationSuggestion
    })
  };

  const submit = await submitOpsDecision({
    lineUserId: 'U1',
    actor: 'ops_readonly',
    requestId,
    traceId,
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS', note: '' },
    safetySnapshot: { consoleServerTime: '2026-02-09T00:00:00.000Z', maxConsoleAgeMs: 300000, reason: 'test' },
    notificationMitigationDecision: { decision: 'ADOPT', note: 'pause', actionType: 'PAUSE_AND_REVIEW', targetNotificationId: 'N_BAD' }
  }, depsForSubmit);
  assert.strictEqual(submit.ok, true);
  assert.ok(submit.decisionLogId);

  const depsForExecute = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      opsState: { failure_class: 'PASS', reasonCode: null, stage: null, note: '' }
    }),
    getKillSwitch: async () => false,
    nowFn: () => new Date('2026-02-09T00:00:10.000Z')
  };

  const exec = await executeOpsNextAction({
    lineUserId: 'U1',
    decisionLogId: submit.decisionLogId,
    action: 'NO_ACTION',
    actor: 'ops_readonly',
    requestId,
    traceId,
    consoleServerTime: '2026-02-09T00:00:00.000Z',
    maxConsoleAgeMs: 300000
  }, depsForExecute);
  assert.strictEqual(exec.ok, true);

  const bundle = await getTraceBundle({ traceId, limit: 50 });
  assert.strictEqual(bundle.ok, true);
  const auditActions = bundle.audits.map((a) => a.action).sort();
  assert.ok(auditActions.includes('ops_console.view'));
  assert.ok(auditActions.includes('notification_mitigation.suggest'));
  assert.ok(auditActions.includes('ops_decision.submit'));
  assert.ok(auditActions.includes('notification_mitigation.decision'));
  assert.ok(auditActions.includes('ops_decision.execute'));

  const decision = bundle.decisions.find((d) => d.subjectType === 'user' && d.subjectId === 'U1');
  assert.ok(decision);
  assert.ok(decision.audit);
  assert.ok(decision.audit.notificationMitigationDecision);
  assert.strictEqual(decision.audit.notificationMitigationDecision.decision, 'ADOPT');
  assert.ok(decision.audit.safetySnapshot);
  assert.strictEqual(decision.audit.safetySnapshot.reason, 'test');
});
