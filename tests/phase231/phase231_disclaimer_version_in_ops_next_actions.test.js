'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

const baseConsole = {
  readiness: { status: 'NOT_READY', blocking: ['missing_step'] },
  blockingReasons: ['missing_step'],
  riskLevel: 'HIGH',
  allowedNextActions: ['STOP_AND_ESCALATE'],
  recommendedNextAction: 'STOP_AND_ESCALATE',
  opsState: { nextAction: 'STOP_AND_ESCALATE', failure_class: 'ENV', reasonCode: 'missing_step', stage: 'phase25' },
  latestDecisionLog: { nextAction: 'STOP_AND_ESCALATE', createdAt: '2026-02-17T00:00:00Z' }
};

test('phase231: ops explanation and next actions include disclaimer version and rendered audit', async () => {
  const audits = [];
  const deps = {
    getOpsConsole: async () => baseConsole,
    appendAuditLog: async (payload) => {
      audits.push(payload);
      return { id: `audit-${audits.length}` };
    },
    env: {},
    getLlmEnabled: async () => false
  };

  const explain = await getOpsExplanation({ lineUserId: 'U231', traceId: 'TRACE231OPS' }, deps);
  assert.strictEqual(explain.ok, true);
  assert.strictEqual(explain.llmUsed, false);
  assert.strictEqual(explain.disclaimerVersion, 'ops_disclaimer_v1');
  assert.ok(typeof explain.disclaimer === 'string' && explain.disclaimer.length > 0);

  const actions = await getNextActionCandidates({ lineUserId: 'U231', traceId: 'TRACE231NEXT' }, deps);
  assert.strictEqual(actions.ok, true);
  assert.strictEqual(actions.llmUsed, false);
  assert.strictEqual(actions.disclaimerVersion, 'next_actions_disclaimer_v1');
  assert.ok(typeof actions.disclaimer === 'string' && actions.disclaimer.length > 0);

  const explainAudit = audits.find((item) => item.action === 'llm_ops_explain_blocked');
  assert.ok(explainAudit);
  assert.strictEqual(explainAudit.payloadSummary.disclaimerVersion, 'ops_disclaimer_v1');

  const nextAudit = audits.find((item) => item.action === 'llm_next_actions_blocked');
  assert.ok(nextAudit);
  assert.strictEqual(nextAudit.payloadSummary.disclaimerVersion, 'next_actions_disclaimer_v1');

});
