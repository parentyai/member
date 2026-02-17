'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function deps(overrides) {
  return Object.assign({
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' },
    faqArticlesRepo: {
      searchActiveArticles: async () => [
        { id: 'a1', title: 't', body: 'b', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['l1'] }
      ]
    },
    linkRegistryRepo: {
      getLink: async () => ({ id: 'l1', lastHealth: { state: 'OK' } })
    },
    llmAdapter: {
      answerFaq: async () => ({
        schemaId: 'FAQAnswer.v1',
        generatedAt: new Date().toISOString(),
        advisoryOnly: true,
        question: 'Q',
        answer: 'A',
        citations: []
      })
    }
  }, overrides || {});
}

test('phaseLLM6: faq blocks when citations are zero', async () => {
  const result = await answerFaqFromKb({ question: 'Q', locale: 'ja' }, deps());
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'citations_required');
});
