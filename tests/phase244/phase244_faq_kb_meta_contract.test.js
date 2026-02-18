'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function buildArticle(id, score) {
  return {
    id,
    title: `${id} title`,
    body: `${id} body`,
    tags: ['faq'],
    riskLevel: 'low',
    linkRegistryIds: ['lk_faq'],
    status: 'active',
    validUntil: new Date('2026-12-31T00:00:00Z'),
    allowedIntents: ['FAQ'],
    disclaimerVersion: 'faq_disclaimer_v1',
    version: '1.0.0',
    versionSemver: '1.0.0',
    searchScore: score
  };
}

test('phase244: blocked low_confidence returns kbMeta and policySnapshotVersion', async () => {
  const result = await answerFaqFromKb(
    {
      question: '会員番号の確認方法',
      traceId: 'TRACE_PHASE244_BLOCK'
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({ lawfulBasis: 'contract', consentVerified: false, crossBorder: true }),
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          buildArticle('faq-1', 1.1),
          buildArticle('faq-2', 1.0)
        ]
      },
      appendAuditLog: async () => ({ id: 'audit-244-block' })
    }
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(result.blockedReason, 'low_confidence');
  assert.strictEqual(result.policySnapshotVersion, 'llm_policy_v1');
  assert.deepStrictEqual(result.kbMeta, {
    matchedCount: 2,
    top1Score: 1.1,
    top2Score: 1,
    top1Top2Ratio: 1.1
  });
});

test('phase244: success response includes kbMeta and policySnapshotVersion', async () => {
  const result = await answerFaqFromKb(
    {
      question: '会員番号の確認方法',
      traceId: 'TRACE_PHASE244_OK'
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({ lawfulBasis: 'contract', consentVerified: false, crossBorder: false }),
      faqArticlesRepo: {
        searchActiveArticles: async () => [buildArticle('faq-1', 2.4)]
      },
      llmAdapter: {
        answerFaq: async () => ({
          answer: {
            schemaId: 'FAQAnswer.v1',
            generatedAt: '2026-02-18T00:00:00.000Z',
            advisoryOnly: true,
            question: '会員番号の確認方法',
            answer: '会員ページで確認できます。',
            citations: [{ sourceType: 'link_registry', sourceId: 'lk_faq' }]
          },
          model: 'test-model'
        })
      },
      linkRegistryRepo: {
        getLink: async () => ({ id: 'lk_faq', lastHealth: { state: 'OK' } })
      },
      appendAuditLog: async () => ({ id: 'audit-244-ok' })
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.policySnapshotVersion, 'llm_policy_v1');
  assert.deepStrictEqual(result.kbMeta, {
    matchedCount: 1,
    top1Score: 2.4,
    top2Score: null,
    top1Top2Ratio: null
  });
});
