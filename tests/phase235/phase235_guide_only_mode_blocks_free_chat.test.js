'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase235: guide-only mode blocks free-chat mode', async () => {
  let adapterCalled = 0;
  const result = await answerFaqFromKb(
    {
      question: '何でも相談したい',
      guideMode: 'free_chat',
      traceId: 'TRACE_PHASE235_FREE_CHAT'
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
  assert.strictEqual(result.blockedReason, 'guide_only_mode_blocked');
  assert.strictEqual(result.blockedReasonCategory, 'GUIDE_MODE_BLOCKED');
  assert.strictEqual(adapterCalled, 0);
});
