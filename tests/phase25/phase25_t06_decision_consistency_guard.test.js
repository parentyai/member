'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsDecisionConsistency } = require('../../src/usecases/phase25/opsDecisionConsistency');
const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');

function makeAudit(status) {
  return {
    readinessStatus: status,
    blocking: status === 'READY' ? [] : ['missing_ops_state'],
    recommendedNextAction: status === 'READY' ? 'NO_ACTION' : 'STOP_AND_ESCALATE',
    allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
    consoleServerTime: '2026-02-07T21:30:00.000Z'
  };
}

test('phase25 t06: opsState missing => WARN', async () => {
  const deps = {
    opsStatesRepo: { getOpsState: async () => null },
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsDecisionConsistency({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.status, 'WARN');
  assert.ok(result.issues.includes('missing_ops_state'));
  assert.ok(result.issues.includes('missing_latest_decision_log'));
});

test('phase25 t06: decisionLog missing => WARN', async () => {
  const deps = {
    opsStatesRepo: { getOpsState: async () => ({ id: 'U1', sourceDecisionLogId: 'd1' }) },
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsDecisionConsistency({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.status, 'WARN');
  assert.ok(result.issues.includes('missing_latest_decision_log'));
});

test('phase25 t06: opsState source mismatch => FAIL', async () => {
  const deps = {
    opsStatesRepo: { getOpsState: async () => ({ id: 'U1', sourceDecisionLogId: 'd1' }) },
    decisionLogsRepo: {
      getLatestDecision: async () => ({ id: 'd2', audit: makeAudit('READY'), nextAction: 'NO_ACTION' })
    }
  };

  const result = await getOpsDecisionConsistency({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.status, 'FAIL');
  assert.ok(result.issues.includes('ops_state_source_mismatch'));
});

test('phase25 t06: missing audit snapshot => FAIL', async () => {
  const deps = {
    opsStatesRepo: { getOpsState: async () => ({ id: 'U1', sourceDecisionLogId: 'd1' }) },
    decisionLogsRepo: { getLatestDecision: async () => ({ id: 'd1', nextAction: 'NO_ACTION' }) }
  };

  const result = await getOpsDecisionConsistency({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.status, 'FAIL');
  assert.ok(result.issues.includes('missing_audit_snapshot'));
});

test('phase25 t06: submit rejects on consistency FAIL', async () => {
  const deps = {
    getOpsConsole: async () => ({
      readiness: { status: 'READY', blocking: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      recommendedNextAction: 'NO_ACTION',
      serverTime: '2026-02-07T21:30:00.000Z',
      consistency: { status: 'FAIL', issues: ['missing_audit_snapshot'] }
    })
  };

  await assert.rejects(
    submitOpsDecision({
      lineUserId: 'U1',
      decision: { nextAction: 'NO_ACTION', failure_class: 'PASS' },
      decidedBy: 'ops',
      dryRun: false
    }, deps),
    /invalid consistency/
  );
});
