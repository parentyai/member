'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase235: personalization beyond allow-list is blocked', async () => {
  let adapterCalled = 0;
  const result = await answerFaqFromKb(
    {
      question: '手続きの進め方を教えて',
      guideMode: 'faq_navigation',
      personalization: {
        locale: 'ja',
        lineUserId: 'U_BLOCKED'
      },
      traceId: 'TRACE_PHASE235_PERSONALIZATION'
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
            title: '会員番号の確認',
            body: '説明',
            tags: ['faq'],
            riskLevel: 'low',
            linkRegistryIds: ['lk_faq']
          }
        ]
      },
      appendAuditLog: async () => ({ id: 'audit-1' }),
      faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
      llmAdapter: {
        answerFaq: async () => {
          adapterCalled += 1;
          return {
            schemaId: 'FAQAnswer.v1',
            generatedAt: new Date().toISOString(),
            advisoryOnly: true,
            question: 'Q',
            answer: 'A',
            citations: [{ sourceType: 'link_registry', sourceId: 'lk_faq' }]
          };
        }
      }
    }
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'personalization_not_allowed');
  assert.strictEqual(result.blockedReasonCategory, 'PERSONALIZATION_BLOCKED');
  assert.strictEqual(adapterCalled, 0);
});
