'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseArticle() {
  return {
    id: 'a1',
    title: 't',
    body: 'b',
    tags: ['tag'],
    riskLevel: 'low',
    linkRegistryIds: ['l1']
  };
}

test('phaseLLM6: audit appends traceId for generated and blocked outcomes', async () => {
  const audits = [];
  const deps = {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => true,
    faqArticlesRepo: { searchActiveArticles: async () => [baseArticle()] },
    linkRegistryRepo: { getLink: async () => ({ id: 'l1', lastHealth: { state: 'OK' } }) },
    appendAuditLog: async (payload) => {
      audits.push(payload);
      return { id: `audit-${audits.length}` };
    },
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
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

  const success = await answerFaqFromKb({ question: 'Q', traceId: 'TRACE_LLM_1' }, deps);
  assert.strictEqual(success.ok, true);

  deps.llmAdapter = {
    answerFaq: async () => ({
      schemaId: 'FAQAnswer.v1',
      generatedAt: new Date().toISOString(),
      advisoryOnly: true,
      question: 'Q',
      answer: 'A',
      citations: []
    })
  };
  const blocked = await answerFaqFromKb({ question: 'Q', traceId: 'TRACE_LLM_2' }, deps);
  assert.strictEqual(blocked.ok, false);

  assert.ok(audits.some((item) => item.action === 'llm_faq_answer_generated' && item.traceId === 'TRACE_LLM_1'));
  assert.ok(audits.some((item) => item.action === 'llm_faq_answer_blocked' && item.traceId === 'TRACE_LLM_2'));
  for (const item of audits) {
    assert.ok(item.payloadSummary);
    assert.ok(Array.isArray(item.payloadSummary.inputFieldCategoriesUsed));
  }
});
