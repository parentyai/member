'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps() {
  return {
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    faqArticlesRepo: {
      searchActiveArticles: async () => [
        { id: 'a1', title: 't', body: 'b', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['l1'] }
      ]
    },
    linkRegistryRepo: { getLink: async () => ({ id: 'l1', lastHealth: { state: 'OK' } }) },
    llmAdapter: {
      answerFaq: async () => ({
        schemaId: 'FAQAnswer.v1',
        generatedAt: new Date().toISOString(),
        advisoryOnly: true,
        question: 'Q',
        answer: 'A',
        citations: [{ sourceType: 'link_registry', sourceId: 'l1' }]
      })
    }
  };
}

test('phaseLLM6: dual gate blocks when db flag is false', async () => {
  const result = await answerFaqFromKb(
    { question: 'Q', locale: 'ja' },
    Object.assign(baseDeps(), { env: { LLM_FEATURE_FLAG: 'true' }, getLlmEnabled: async () => false })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'llm_disabled');
});

test('phaseLLM6: dual gate blocks when env flag is false', async () => {
  const result = await answerFaqFromKb(
    { question: 'Q', locale: 'ja' },
    Object.assign(baseDeps(), { env: { LLM_FEATURE_FLAG: 'false' }, getLlmEnabled: async () => true })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'llm_disabled');
});

test('phaseLLM6: dual gate allows when db+env are true', async () => {
  const result = await answerFaqFromKb(
    { question: 'Q', locale: 'ja' },
    Object.assign(baseDeps(), { env: { LLM_FEATURE_FLAG: 'true' }, getLlmEnabled: async () => true })
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.llmStatus, 'ok');
  assert.strictEqual(result.llmUsed, true);
});
