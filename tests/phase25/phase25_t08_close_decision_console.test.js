'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

test('phase25 t08: READY yields closeDecision CLOSE', async () => {
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.strictEqual(result.closeDecision, 'CLOSE');
  assert.strictEqual(result.closeReason, 'readiness_ready');
  assert.strictEqual(result.phaseResult, 'READY');
});

test('phase25 t08: NOT_READY yields closeDecision NO_CLOSE', async () => {
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'NOT_READY', blocking: ['missing_ops_state'] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U2' }, deps);
  assert.strictEqual(result.closeDecision, 'NO_CLOSE');
  assert.strictEqual(result.closeReason, 'readiness_not_ready');
  assert.strictEqual(result.phaseResult, 'NOT_READY');
});

test('phase25 t08: consistency FAIL yields closeDecision NO_CLOSE', async () => {
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'FAIL', issues: ['missing_audit_snapshot'] }),
    decisionLogsRepo: { getLatestDecision: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U3' }, deps);
  assert.strictEqual(result.closeDecision, 'NO_CLOSE');
  assert.strictEqual(result.closeReason, 'consistency_fail');
  assert.strictEqual(result.phaseResult, 'CONSISTENCY_FAIL');
});
