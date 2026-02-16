'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

const baseConsole = {
  readiness: { status: 'READY', blocking: [] },
  opsState: { nextAction: 'NO_ACTION', failure_class: 'PASS', reasonCode: 'OK', stage: 'phase25' },
  latestDecisionLog: { nextAction: 'NO_ACTION', createdAt: '2026-02-10T00:00:00Z' },
  allowedNextActions: ['NO_ACTION', 'RERUN_MAIN']
};

function stubDeps(overrides) {
  return Object.assign({
    getOpsConsole: async () => baseConsole,
    appendAuditLog: async () => ({ id: 'audit-1' })
  }, overrides || {});
}

test('phaseLLM3: fallback when LLM disabled', async () => {
  const result = await getNextActionCandidates({ lineUserId: 'U123' }, stubDeps({ env: {} }));
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'disabled');
  assert.equal(result.nextActionCandidates.schemaId, 'NextActionCandidates.v1');
  assert.equal(result.nextActionCandidates.advisoryOnly, true);
  assert.ok(Array.isArray(result.nextActionCandidates.candidates));
});

test('phaseLLM3: accepts valid LLM candidates when enabled', async () => {
  const payload = {
    schemaId: 'NextActionCandidates.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    candidates: [
      { action: 'MONITOR', reason: 'monitor outcomes', confidence: 0.6, safety: { status: 'OK', reasons: [] } }
    ]
  };
  const result = await getNextActionCandidates(
    { lineUserId: 'U123' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: {
        suggestNextActionCandidates: async () => payload
      }
    })
  );
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
  assert.deepEqual(result.nextActionCandidates, payload);
});

test('phaseLLM3: invalid LLM candidates fallback', async () => {
  const invalid = {
    schemaId: 'NextActionCandidates.v1',
    generatedAt: 'bad-date',
    advisoryOnly: true,
    candidates: []
  };
  const result = await getNextActionCandidates(
    { lineUserId: 'U123' },
    stubDeps({
      env: { LLM_FEATURE_FLAG: 'true' },
      llmAdapter: {
        suggestNextActionCandidates: async () => invalid
      }
    })
  );
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'invalid_schema');
  assert.ok(Array.isArray(result.nextActionCandidates.candidates));
  assert.ok(result.nextActionCandidates.candidates.length > 0);
});
