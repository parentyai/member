'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');

const baseConsole = {
  readiness: { status: 'NOT_READY', blocking: ['missing_step'] },
  blockingReasons: ['missing_step'],
  riskLevel: 'HIGH',
  allowedNextActions: ['STOP_AND_ESCALATE'],
  recommendedNextAction: 'STOP_AND_ESCALATE',
  executionStatus: {
    lastExecutionResult: 'FAIL',
    lastFailureClass: 'ENV',
    lastReasonCode: 'ERR',
    lastStage: 'phase25'
  },
  decisionDrift: { status: 'WARN', types: ['drift_a'] },
  closeDecision: 'NO',
  closeReason: 'missing_step',
  phaseResult: 'BLOCKED',
  lastReactionAt: '2026-02-10T00:00:00Z',
  dangerFlags: { notReady: true, staleMemberNumber: false },
  notificationHealthSummary: {
    totalNotifications: 10,
    countsByHealth: { OK: 8, WARN: 2 },
    unhealthyCount: 2
  },
  mitigationSuggestion: { type: 'retry' }
};

function stubDeps(overrides) {
  return Object.assign({
    getOpsConsole: async () => baseConsole,
    appendAuditLog: async () => ({ id: 'audit-1' })
  }, overrides || {});
}

test('phaseLLM2: explanation fallback when LLM disabled', async () => {
  const result = await getOpsExplanation({ lineUserId: 'U123' }, stubDeps({ env: {} }));
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'disabled');
  assert.equal(result.explanation.schemaId, 'OpsExplanation.v1');
  assert.equal(result.explanation.advisoryOnly, true);
  assert.ok(Array.isArray(result.explanation.facts));
  assert.ok(result.explanation.facts.length > 0);
});

test('phaseLLM2: accepts valid LLM explanation when enabled', async () => {
  const explanation = {
    schemaId: 'OpsExplanation.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    facts: [],
    interpretations: []
  };
  const result = await getOpsExplanation(
    { lineUserId: 'U123' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: {
        explainOps: async () => ({ explanation, model: 'test-model' })
      }
    })
  );
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.equal(result.llmModel, 'test-model');
  assert.deepEqual(result.explanation, explanation);
});

test('phaseLLM2: invalid LLM output falls back', async () => {
  const invalid = {
    schemaId: 'OpsExplanation.v1',
    generatedAt: 'bad-date',
    advisoryOnly: true,
    facts: [],
    interpretations: []
  };
  const result = await getOpsExplanation(
    { lineUserId: 'U123' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: {
        explainOps: async () => ({ explanation: invalid })
      }
    })
  );
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'invalid_schema');
  assert.ok(Array.isArray(result.explanation.facts));
  assert.ok(result.explanation.facts.length > 0);
});
