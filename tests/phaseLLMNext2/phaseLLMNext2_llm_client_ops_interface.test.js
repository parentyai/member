'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const llmClient = require('../../src/infra/llmClient');

function makeFakeEnv(answer) {
  return {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: JSON.stringify(answer) } }]
      })
    })
  };
}

test('llmClient: exports explainOps method', () => {
  assert.equal(typeof llmClient.explainOps, 'function');
});

test('llmClient: exports suggestNextActionCandidates method', () => {
  assert.equal(typeof llmClient.suggestNextActionCandidates, 'function');
});

test('llmClient.explainOps: throws when OPENAI_API_KEY is not set', async () => {
  const origKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => llmClient.explainOps({ schemaId: 'OpsExplanation.v1', system: 's', input: {} }),
      (err) => err.message.includes('OPENAI_API_KEY')
    );
  } finally {
    if (origKey !== undefined) process.env.OPENAI_API_KEY = origKey;
  }
});

test('llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set', async () => {
  const origKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => llmClient.suggestNextActionCandidates({ schemaId: 'NextActionCandidates.v1', system: 's', input: {} }),
      (err) => err.message.includes('OPENAI_API_KEY')
    );
  } finally {
    if (origKey !== undefined) process.env.OPENAI_API_KEY = origKey;
  }
});

test('llmClient: callOpsExplain returns { answer, model } on success', async () => {
  const fakeAnswer = { schemaId: 'OpsExplanation.v1', advisoryOnly: true };
  const env = makeFakeEnv(fakeAnswer);
  const result = await llmClient.callOpsExplain({ system: 's', input: {} }, env);
  assert.deepEqual(result.answer, fakeAnswer);
  assert.equal(result.model, 'gpt-4o-mini');
});

test('llmClient: callNextActionCandidates returns { answer, model } on success', async () => {
  const fakeAnswer = { schemaId: 'NextActionCandidates.v1', advisoryOnly: true, candidates: [] };
  const env = makeFakeEnv(fakeAnswer);
  const result = await llmClient.callNextActionCandidates({ system: 's', input: {} }, env);
  assert.deepEqual(result.answer, fakeAnswer);
  assert.equal(result.model, 'gpt-4o-mini');
});
