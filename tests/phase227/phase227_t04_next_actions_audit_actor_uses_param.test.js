'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

test('phase227 t04: next-actions audit actor follows params.actor (no llm)', async () => {
  const captured = [];
  const result = await getNextActionCandidates({
    lineUserId: 'U1',
    traceId: 't1',
    actor: 'alice',
    consoleResult: {
      readiness: { status: 'NOT_READY', blocking: ['registration:missing_step_key'] },
      opsState: { nextAction: 'REVIEW', stage: 'phase24' },
      latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2026-02-17T00:00:00Z' },
      allowedNextActions: ['REVIEW', 'ESCALATE', 'NO_ACTION']
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
  assert.equal(captured.length, 1);
  assert.equal(captured[0].actor, 'alice');
  assert.equal(captured[0].traceId, 't1');
  assert.equal(captured[0].lineUserId, 'U1');
});

