'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');

test('phase227 t03: ops-explain audit actor follows params.actor (no llm)', async () => {
  const captured = [];
  const result = await getOpsExplanation({
    lineUserId: 'U1',
    traceId: 't1',
    actor: 'alice',
    consoleResult: {
      readiness: { status: 'NOT_READY', blocking: ['registration:missing_step_key'] },
      blockingReasons: ['registration:missing_step_key'],
      riskLevel: 'HIGH'
    }
  }, {
    env: { LLM_FEATURE_FLAG: '0' },
    getLlmEnabled: async () => false,
    appendAuditLog: async (payload) => {
      captured.push(payload);
      return { id: 'a1' };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.auditId, 'a1');
  assert.ok(captured.length >= 1);
  const primary = captured.find((item) => item.action === 'llm_ops_explain_blocked' || item.action === 'llm_ops_explain_generated');
  assert.ok(primary);
  assert.equal(primary.actor, 'alice');
  assert.equal(primary.traceId, 't1');
  assert.equal(primary.lineUserId, 'U1');
});
