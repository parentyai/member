'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');

// Provide non-null executionStatus and decisionDrift so buildInputFromConsole
// expands them to sub-paths that are covered by the allow list.
const BASE_CONSOLE = {
  readiness: { status: 'NOT_READY', blocking: ['missingDoc'] },
  blockingReasons: ['missingDoc'],
  riskLevel: 'medium',
  allowedNextActions: ['ESCALATE', 'REVIEW'],
  recommendedNextAction: 'ESCALATE',
  executionStatus: { lastExecutionResult: null, lastFailureClass: null, lastReasonCode: null, lastStage: null },
  decisionDrift: { status: null, types: [] },
  closeDecision: null,
  closeReason: null,
  phaseResult: null,
  lastReactionAt: null,
  dangerFlags: { notReady: true, staleMemberNumber: false },
  notificationHealthSummary: { totalNotifications: 5, unhealthyCount: 2, countsByHealth: { OK: 3, NG: 2 } },
  mitigationSuggestion: 'Check doc status'
};

function makeDeps(overrides) {
  return {
    getOpsConsole: async () => BASE_CONSOLE,
    appendAuditLog: async () => ({ id: 'audit-1' }),
    getLlmEnabled: async () => false,
    getLlmPolicy: async () => ({ lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false }),
    env: { LLM_FEATURE_FLAG: '0' },
    ...overrides
  };
}

test('getOpsExplanation: returns ok:true with fallback when LLM disabled', async () => {
  const deps = makeDeps();
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'disabled');
  assert.ok(result.explanation);
  assert.equal(result.explanation.advisoryOnly, true);
});

test('getOpsExplanation: response includes opsTemplate (ops_template_v1)', async () => {
  const deps = makeDeps();
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.ok(result.opsTemplate);
  assert.equal(result.opsTemplate.templateVersion, 'ops_template_v1');
  assert.equal(result.opsTemplate.currentState.readinessStatus, 'NOT_READY');
  assert.equal(result.opsTemplate.currentState.riskLevel, 'medium');
});

test('getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1)', async () => {
  const deps = makeDeps();
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.ok(result.opsHealthTemplate);
  assert.equal(result.opsHealthTemplate.templateVersion, 'ops_health_template_v1');
  assert.equal(result.opsHealthTemplate.dangerFlags.notReady, true);
  assert.equal(result.opsHealthTemplate.notificationHealth.totalNotifications, 5);
  assert.equal(result.opsHealthTemplate.notificationHealth.unhealthyCount, 2);
  assert.equal(result.opsHealthTemplate.mitigationSuggestion, 'Check doc status');
});

test('getOpsExplanation: uses llmAdapter.explainOps when LLM enabled', async () => {
  const fakeExplanation = {
    schemaId: 'OpsExplanation.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    facts: [],
    interpretations: [
      { statement: 'State is not ready', basedOn: ['readiness.status'], confidence: 0.9 }
    ]
  };
  let adapterCalled = false;
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' },
    llmAdapter: {
      explainOps: async () => {
        adapterCalled = true;
        // Return envelope format: { explanation, model }
        return { explanation: fakeExplanation, model: 'gpt-4o-mini' };
      }
    }
  });
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(adapterCalled, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.equal(result.llmModel, 'gpt-4o-mini');
});

test('getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps)', async () => {
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' }
    // llmAdapter NOT provided
  });
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.ok(result.llmStatus.includes('adapter_missing'));
});

test('getOpsExplanation: falls back on LLM timeout', async () => {
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' },
    llmTimeoutMs: 1,
    llmAdapter: {
      explainOps: () => new Promise((resolve) => setTimeout(resolve, 500))
    }
  });
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.ok(result.llmStatus.includes('llm_timeout'));
});

test('getOpsExplanation: includes disclaimer in response', async () => {
  const deps = makeDeps();
  const result = await getOpsExplanation({ lineUserId: 'U123', traceId: 'tr1', actor: 'admin' }, deps);
  assert.ok(typeof result.disclaimerVersion === 'string' && result.disclaimerVersion.length > 0);
  assert.ok(typeof result.disclaimer === 'string' && result.disclaimer.length > 0);
});

test('getOpsExplanation: throws when lineUserId is missing', async () => {
  const deps = makeDeps();
  await assert.rejects(
    () => getOpsExplanation({ traceId: 'tr1', actor: 'admin' }, deps),
    (err) => err.message.includes('lineUserId')
  );
});
