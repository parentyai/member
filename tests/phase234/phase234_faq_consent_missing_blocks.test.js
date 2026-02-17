'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false', async () => {
  let adapterCalled = 0;
  const audits = [];
  const result = await answerFaqFromKb(
    {
      question: '会員番号の確認方法を教えてください',
      traceId: 'TRACE_PHASE234_CONSENT'
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({
        lawfulBasis: 'consent',
        consentVerified: false,
        crossBorder: true
      }),
      faqArticlesRepo: {
        searchActiveArticles: async () => [
          {
            id: 'faq-1',
            title: '会員番号の確認方法',
            body: '確認方法です',
            tags: ['member'],
            riskLevel: 'low',
            linkRegistryIds: ['lk_faq']
          }
        ]
      },
      appendAuditLog: async (payload) => {
        audits.push(payload);
        return { id: `audit-${audits.length}` };
      },
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
  assert.strictEqual(result.blockedReason, 'consent_missing');
  assert.strictEqual(result.blockedReasonCategory, 'CONSENT_MISSING');
  assert.strictEqual(adapterCalled, 0);

  const blockedAudit = audits.find((item) => item.action === 'llm_faq_answer_blocked');
  assert.ok(blockedAudit);
  assert.strictEqual(blockedAudit.payloadSummary.blockedReason, 'consent_missing');
  assert.strictEqual(blockedAudit.payloadSummary.blockedReasonCategory, 'CONSENT_MISSING');
  assert.strictEqual(blockedAudit.payloadSummary.lawfulBasis, 'consent');
  assert.strictEqual(blockedAudit.payloadSummary.consentVerified, false);
  assert.strictEqual(blockedAudit.payloadSummary.crossBorder, true);
});
