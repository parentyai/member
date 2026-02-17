'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps() {
  return {
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' }
  };
}

test('phase229: faq blocks when high-risk article has no contact source', async () => {
  let called = 0;
  const result = await answerFaqFromKb(
    { question: '会員証が失効した', locale: 'ja' },
    Object.assign(baseDeps(), {
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          { id: 'a1', title: 't', body: 'b', tags: ['tag'], riskLevel: 'high', linkRegistryIds: [] }
        ]
      },
      llmAdapter: {
        answerFaq: async () => {
          called += 1;
          return null;
        }
      }
    })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'contact_source_required');
  assert.strictEqual(called, 0);
});

test('phase229: faq blocks when high-risk citation omits contact source', async () => {
  const result = await answerFaqFromKb(
    { question: '会員証が失効した', locale: 'ja' },
    Object.assign(baseDeps(), {
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          { id: 'a1', title: 't1', body: 'b1', tags: ['risk'], riskLevel: 'high', linkRegistryIds: ['contact_1'] },
          { id: 'a2', title: 't2', body: 'b2', tags: ['general'], riskLevel: 'low', linkRegistryIds: ['general_1'] }
        ]
      },
      linkRegistryRepo: {
        getLink: async () => ({ id: 'general_1', lastHealth: { state: 'OK' } })
      },
      llmAdapter: {
        answerFaq: async () => ({
          schemaId: 'FAQAnswer.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          question: '会員証が失効した',
          answer: '一般窓口をご確認ください。',
          citations: [{ sourceType: 'link_registry', sourceId: 'general_1' }]
        })
      }
    })
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'contact_source_required');
});

test('phase229: faq passes when high-risk citation includes contact source', async () => {
  const result = await answerFaqFromKb(
    { question: '会員証が失効した', locale: 'ja' },
    Object.assign(baseDeps(), {
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          { id: 'a1', title: 't1', body: 'b1', tags: ['risk'], riskLevel: 'high', linkRegistryIds: ['contact_1'] }
        ]
      },
      linkRegistryRepo: {
        getLink: async () => ({ id: 'contact_1', lastHealth: { state: 'OK' } })
      },
      llmAdapter: {
        answerFaq: async () => ({
          schemaId: 'FAQAnswer.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          question: '会員証が失効した',
          answer: 'お問い合わせ窓口をご確認ください。',
          citations: [{ sourceType: 'link_registry', sourceId: 'contact_1' }]
        })
      }
    })
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.httpStatus, 200);
  assert.strictEqual(result.blockedReason, null);
});

