'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

const ALLOWED_ALL = ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'];

test('phase25 t07: READY recommended is in allowedNextActions', async () => {
  const readiness = { status: 'READY', blocking: [] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.deepStrictEqual(result.allowedNextActions, ALLOWED_ALL);
  assert.ok(result.allowedNextActions.includes(result.recommendedNextAction));
  assert.strictEqual(result.recommendedNextAction, 'NO_ACTION');
});

test('phase25 t07: NOT_READY forces STOP_AND_ESCALATE only', async () => {
  const readiness = { status: 'NOT_READY', blocking: ['missing_ops_state'] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U2' }, deps);
  assert.deepStrictEqual(result.allowedNextActions, ['STOP_AND_ESCALATE']);
  assert.strictEqual(result.recommendedNextAction, 'STOP_AND_ESCALATE');
});

test('phase25 t07: consistency FAIL downgrades readiness to NOT_READY', async () => {
  const readiness = { status: 'READY', blocking: [] };
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: readiness,
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'FAIL', issues: ['missing_audit_snapshot'] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U3' }, deps);
  assert.strictEqual(result.readiness.status, 'NOT_READY');
  assert.ok(result.readiness.blocking.includes('consistency:missing_audit_snapshot'));
  assert.deepStrictEqual(result.allowedNextActions, ['STOP_AND_ESCALATE']);
  assert.strictEqual(result.recommendedNextAction, 'STOP_AND_ESCALATE');
});
