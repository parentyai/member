'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps() {
  return {
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' },
    faqArticlesRepo: {
      searchActiveArticles: async () => [
        { id: 'a1', title: 't', body: 'b', tags: ['tag'], riskLevel: 'low', linkRegistryIds: ['l1'] }
      ]
    }
  };
}

test('phaseLLM6: faq blocks direct URL in answer', async () => {
  const result = await answerFaqFromKb(
    { question: 'Q', locale: 'ja' },
    Object.assign(baseDeps(), {
      linkRegistryRepo: { getLink: async () => ({ id: 'l1', lastHealth: { state: 'OK' } }) },
      llmAdapter: {
        answerFaq: async () => ({
          schemaId: 'FAQAnswer.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          question: 'Q',
          answer: 'https://example.com を見てください',
          citations: [{ sourceType: 'link_registry', sourceId: 'l1' }]
        })
      }
    })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'direct_url_forbidden');
});

test('phaseLLM6: faq blocks WARN link', async () => {
  const result = await answerFaqFromKb(
    { question: 'Q', locale: 'ja' },
    Object.assign(baseDeps(), {
      linkRegistryRepo: { getLink: async () => ({ id: 'l1', lastHealth: { state: 'WARN' } }) },
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
    })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'warn_link_blocked');
});
