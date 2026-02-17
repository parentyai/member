'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

test('phase231: faq includes disclaimer version in response and audit events', async () => {
  const audits = [];
  const deps = {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => true,
    faqArticlesRepo: {
      searchActiveArticles: async () => [
        {
          id: 'a1',
          title: '会員番号',
          body: '会員番号はマイページで確認できます',
          tags: ['会員番号'],
          riskLevel: 'low',
          linkRegistryIds: ['l1'],
          searchScore: 3.2
        }
      ]
    },
    llmAdapter: {
      answerFaq: async () => ({
        schemaId: 'FAQAnswer.v1',
        generatedAt: new Date().toISOString(),
        advisoryOnly: true,
        question: '会員番号を確認したい',
        answer: '会員番号はマイページで確認できます。',
        citations: [{ sourceType: 'link_registry', sourceId: 'l1' }]
      })
    },
    linkRegistryRepo: {
      getLink: async () => ({ id: 'l1', lastHealth: { state: 'OK' } })
    },
    appendAuditLog: async (payload) => {
      audits.push(payload);
      return { id: `audit-${audits.length}` };
    },
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) }
  };

  const result = await answerFaqFromKb({ question: '会員番号を確認したい', traceId: 'TRACE231FAQ' }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.disclaimerVersion, 'faq_disclaimer_v1');
  assert.ok(typeof result.disclaimer === 'string' && result.disclaimer.length > 0);

  const generatedAudit = audits.find((item) => item.action === 'llm_faq_answer_generated');
  assert.ok(generatedAudit);
  assert.strictEqual(generatedAudit.payloadSummary.disclaimerVersion, 'faq_disclaimer_v1');

  const disclaimerAudit = audits.find((item) => item.action === 'llm_disclaimer_rendered');
  assert.ok(disclaimerAudit);
  assert.strictEqual(disclaimerAudit.payloadSummary.purpose, 'faq');
  assert.strictEqual(disclaimerAudit.payloadSummary.disclaimerVersion, 'faq_disclaimer_v1');
  assert.strictEqual(disclaimerAudit.payloadSummary.disclaimerShown, true);
});

test('phase231: faq blocked response still includes disclaimer and rendered audit', async () => {
  const audits = [];
  const deps = {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => false,
    faqArticlesRepo: {
      searchActiveArticles: async () => [
        {
          id: 'a1',
          title: '会員番号',
          body: '会員番号はマイページで確認できます',
          tags: ['会員番号'],
          riskLevel: 'low',
          linkRegistryIds: ['l1'],
          searchScore: 3.2
        }
      ]
    },
    appendAuditLog: async (payload) => {
      audits.push(payload);
      return { id: `audit-${audits.length}` };
    },
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) }
  };

  const result = await answerFaqFromKb({ question: '会員番号を確認したい', traceId: 'TRACE231FAQBLOCK' }, deps);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'llm_disabled');
  assert.strictEqual(result.disclaimerVersion, 'faq_disclaimer_v1');
  assert.ok(typeof result.disclaimer === 'string' && result.disclaimer.length > 0);

  const disclaimerAudit = audits.find((item) => item.action === 'llm_disclaimer_rendered');
  assert.ok(disclaimerAudit);
  assert.strictEqual(disclaimerAudit.payloadSummary.purpose, 'faq');
  assert.strictEqual(disclaimerAudit.payloadSummary.llmStatus, 'llm_disabled');
});
