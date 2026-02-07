'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

test('phase25 t04: console READY uses opsState nextAction', async () => {
  const readiness = { status: 'READY', blocking: [] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: { nextAction: 'FIX_AND_RERUN' }
    }),
    getMemberSummary: async () => ({ ok: true }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const consoleResult = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.strictEqual(consoleResult.recommendedNextAction, 'FIX_AND_RERUN');
  assert.ok(consoleResult.allowedNextActions.includes(consoleResult.recommendedNextAction));
});

test('phase25 t04: console READY without opsState defaults to NO_ACTION', async () => {
  const readiness = { status: 'READY', blocking: [] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const consoleResult = await getOpsConsole({ lineUserId: 'U2' }, deps);
  assert.strictEqual(consoleResult.recommendedNextAction, 'NO_ACTION');
  assert.ok(consoleResult.allowedNextActions.includes(consoleResult.recommendedNextAction));
});

test('phase25 t04: console NOT_READY recommends STOP_AND_ESCALATE and submits', async () => {
  const readiness = { status: 'NOT_READY', blocking: ['missing_notification_summary'] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const consoleResult = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.strictEqual(consoleResult.recommendedNextAction, 'STOP_AND_ESCALATE');
  assert.ok(Array.isArray(consoleResult.allowedNextActions));
  assert.ok(consoleResult.allowedNextActions.includes(consoleResult.recommendedNextAction));

  const submitDeps = {
    getUserStateSummary: async () => ({
      registrationCompleteness: { ok: true, missing: [] },
      userSummaryCompleteness: { ok: true, missing: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsStateCompleteness: { status: 'WARN', missing: ['missing_ops_state'] },
      opsDecisionCompleteness: { status: 'WARN', missing: ['missing_ops_state'] }
    }),
    evaluateOverallDecisionReadiness: () => readiness,
    recordOpsNextAction: async () => ({ decisionLogId: 'd1', opsState: { id: 'U1', nextAction: 'STOP_AND_ESCALATE' } })
  };

  const submitResult = await submitOpsDecision({
    lineUserId: 'U1',
    decision: {
      nextAction: consoleResult.recommendedNextAction,
      failure_class: 'IMPL'
    },
    decidedBy: 'ops',
    dryRun: false
  }, submitDeps);

  assert.strictEqual(submitResult.ok, true);
  assert.strictEqual(submitResult.decisionLogId, 'd1');
  assert.strictEqual(submitResult.opsState.nextAction, 'STOP_AND_ESCALATE');
});
