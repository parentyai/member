'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

function createConsoleResult() {
  return {
    readiness: { status: 'NOT_READY', blocking: ['post_check_failed'] },
    blockingReasons: ['post_check_failed'],
    riskLevel: 'HIGH',
    allowedNextActions: ['REVIEW', 'ESCALATE'],
    recommendedNextAction: 'REVIEW',
    opsState: { nextAction: 'REVIEW' },
    latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2026-02-17T00:00:00.000Z' }
  };
}

test('phase234: ops/next-actions audit payload includes llmPolicy snapshot fields', async () => {
  const audits = [];
  const deps = {
    env: { LLM_FEATURE_FLAG: 'false' },
    getLlmEnabled: async () => true,
    getLlmPolicy: async () => ({
      lawfulBasis: 'contract',
      consentVerified: false,
      crossBorder: false
    }),
    getOpsConsole: async () => createConsoleResult(),
    appendAuditLog: async (payload) => {
      audits.push(payload);
      return { id: `audit-${audits.length}` };
    }
  };

  const explain = await getOpsExplanation({ lineUserId: 'U_OPS_1', traceId: 'TRACE_OPS_1' }, deps);
  const nextActions = await getNextActionCandidates({ lineUserId: 'U_OPS_1', traceId: 'TRACE_OPS_2' }, deps);

  assert.strictEqual(explain.ok, true);
  assert.strictEqual(nextActions.ok, true);

  const opsAudit = audits.find((item) => item.action === 'llm_ops_explain_blocked');
  const nextAudit = audits.find((item) => item.action === 'llm_next_actions_blocked');

  assert.ok(opsAudit);
  assert.ok(nextAudit);
  assert.strictEqual(opsAudit.payloadSummary.lawfulBasis, 'contract');
  assert.strictEqual(opsAudit.payloadSummary.consentVerified, false);
  assert.strictEqual(opsAudit.payloadSummary.crossBorder, false);
  assert.ok(Array.isArray(opsAudit.payloadSummary.fieldCategoriesUsed));

  assert.strictEqual(nextAudit.payloadSummary.lawfulBasis, 'contract');
  assert.strictEqual(nextAudit.payloadSummary.consentVerified, false);
  assert.strictEqual(nextAudit.payloadSummary.crossBorder, false);
  assert.ok(Array.isArray(nextAudit.payloadSummary.fieldCategoriesUsed));
});
