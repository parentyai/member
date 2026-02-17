'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { FAQ_ANSWER_SCHEMA_ID, NEXT_ACTION_CANDIDATES_SCHEMA_ID } = require('../../src/llm/schemas');
const { guardLlmOutput } = require('../../src/usecases/llm/guardLlmOutput');

const faqBase = {
  schemaId: FAQ_ANSWER_SCHEMA_ID,
  generatedAt: new Date().toISOString(),
  advisoryOnly: true,
  question: 'Q',
  answer: 'A',
  citations: [{ sourceType: 'link_registry', sourceId: 's1' }]
};

test('phaseLLM6: faq output blocks when citations are missing', async () => {
  const result = await guardLlmOutput({
    purpose: 'faq',
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    output: Object.assign({}, faqBase, { citations: [] }),
    requireCitations: true,
    allowedSourceIds: ['s1']
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'citations_required');
});

test('phaseLLM6: faq output blocks direct URL', async () => {
  const result = await guardLlmOutput({
    purpose: 'faq',
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    output: Object.assign({}, faqBase, { answer: '詳しくは https://example.com を参照' }),
    requireCitations: true,
    allowedSourceIds: ['s1']
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'direct_url_forbidden');
});

test('phaseLLM6: next actions block invalid action', async () => {
  const result = await guardLlmOutput({
    purpose: 'next_actions',
    schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
    output: {
      schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
      generatedAt: new Date().toISOString(),
      advisoryOnly: true,
      candidates: [
        { action: 'EXECUTE_NOW', reason: 'bad', confidence: 0.9, safety: { status: 'OK', reasons: [] } }
      ]
    }
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'invalid_action');
});
