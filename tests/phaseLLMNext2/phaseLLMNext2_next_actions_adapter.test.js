'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

const BASE_CONSOLE = {
  readiness: { status: 'NOT_READY', blocking: ['missingDoc'] },
  opsState: { nextAction: 'REVIEW', failure_class: null, reasonCode: null, stage: 'PENDING' },
  latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2024-01-01T00:00:00.000Z' },
  allowedNextActions: ['ESCALATE', 'REVIEW', 'NO_ACTION']
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

test('getNextActionCandidates: returns ok:true with fallback when LLM disabled', async () => {
  const deps = makeDeps();
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'disabled');
  assert.ok(result.nextActionCandidates);
  assert.equal(result.nextActionCandidates.advisoryOnly, true);
});

test('getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only', async () => {
  const deps = makeDeps();
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  const { candidates } = result.nextActionCandidates;
  assert.ok(Array.isArray(candidates));
  assert.ok(candidates.length <= 3);
  const ABSTRACT = ['MONITOR', 'REVIEW', 'ESCALATE', 'DEFER', 'NO_ACTION'];
  for (const c of candidates) {
    assert.ok(ABSTRACT.includes(c.action), `Unexpected action: ${c.action}`);
  }
});

test('getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1)', async () => {
  const deps = makeDeps();
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  assert.ok(result.nextActionTemplate);
  assert.equal(result.nextActionTemplate.templateVersion, 'next_actions_template_v1');
  assert.ok(result.nextActionTemplate.currentState);
  assert.ok(result.nextActionTemplate.proposal);
});

test('getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled', async () => {
  const fakeOutput = {
    schemaId: 'NextActionCandidates.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    candidates: [
      { action: 'ESCALATE', reason: 'not ready', confidence: 0.8, safety: { status: 'OK', reasons: [] } },
      { action: 'REVIEW', reason: 'check state', confidence: 0.5, safety: { status: 'OK', reasons: [] } }
    ]
  };
  let adapterCalled = false;
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' },
    llmAdapter: {
      // Return envelope format: { nextActionCandidates, model }
      suggestNextActionCandidates: async () => {
        adapterCalled = true;
        return { nextActionCandidates: fakeOutput, model: 'gpt-4o-mini' };
      }
    }
  });
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(adapterCalled, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.equal(result.llmModel, 'gpt-4o-mini');
  assert.ok(Array.isArray(result.nextActionCandidates.candidates));
});

test('getNextActionCandidates: falls back when adapter_missing', async () => {
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' }
    // llmAdapter NOT provided
  });
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.ok(result.llmStatus.includes('adapter_missing'));
});

test('getNextActionCandidates: LLM output with invalid action is filtered out', async () => {
  const fakeOutput = {
    schemaId: 'NextActionCandidates.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    candidates: [
      { action: 'EXECUTE_NOW', reason: 'invalid', confidence: 0.9, safety: { status: 'OK', reasons: [] } },
      { action: 'MONITOR', reason: 'ok to monitor', confidence: 0.5, safety: { status: 'OK', reasons: [] } }
    ]
  };
  const deps = makeDeps({
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: '1' },
    llmAdapter: {
      suggestNextActionCandidates: async () => ({ nextActionCandidates: fakeOutput, model: 'gpt-4o-mini' })
    }
  });
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  const actions = result.nextActionCandidates.candidates.map((c) => c.action);
  assert.ok(!actions.includes('EXECUTE_NOW'), 'EXECUTE_NOW should be filtered out');
  // Guard blocks the invalid output; fallback candidates for NOT_READY include ESCALATE
  assert.ok(actions.includes('ESCALATE'));
});

test('getNextActionCandidates: includes disclaimer in response', async () => {
  const deps = makeDeps();
  const result = await getNextActionCandidates({ lineUserId: 'U456', traceId: 'tr2', actor: 'admin' }, deps);
  assert.ok(typeof result.disclaimerVersion === 'string' && result.disclaimerVersion.length > 0);
  assert.ok(typeof result.disclaimer === 'string' && result.disclaimer.length > 0);
});

test('getNextActionCandidates: throws when lineUserId is missing', async () => {
  const deps = makeDeps();
  await assert.rejects(
    () => getNextActionCandidates({ traceId: 'tr2', actor: 'admin' }, deps),
    (err) => err.message.includes('lineUserId')
  );
});
