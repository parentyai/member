'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase235: checklist_guidance mode is allowed and returns answer when guard passes', async () => {
  const result = await answerFaqFromKb(
    {
      question: '出発前のチェックリストを教えて',
      guideMode: 'checklist_guidance',
      personalization: {
        locale: 'ja',
        servicePhase: 2
      },
      traceId: 'TRACE_PHASE235_GUIDANCE_ALLOWED'
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({
        lawfulBasis: 'contract',
        consentVerified: false,
        crossBorder: false
      }),
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          {
            id: 'faq-1',
            title: '出発前チェック',
            body: '案内',
            tags: ['checklist'],
            riskLevel: 'low',
            linkRegistryIds: ['lk_checklist']
          }
        ]
      },
      linkRegistryRepo: {
        getLink: async () => ({ id: 'lk_checklist', lastHealth: { state: 'OK' } })
      },
      appendAuditLog: async () => ({ id: 'audit-1' }),
      faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
      llmAdapter: {
        answerFaq: async () => ({
          schemaId: 'FAQAnswer.v1',
          generatedAt: new Date().toISOString(),
          advisoryOnly: true,
          question: 'Q',
          answer: 'A',
          citations: [{ sourceType: 'link_registry', sourceId: 'lk_checklist' }]
        })
      }
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.blockedReason, null);
  assert.strictEqual(result.faqAnswer.citations[0].sourceId, 'lk_checklist');
});
