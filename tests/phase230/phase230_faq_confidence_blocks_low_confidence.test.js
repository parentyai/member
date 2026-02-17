'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps(candidates) {
  return {
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' },
    faqArticlesRepo: {
      searchActiveArticles: async () => candidates
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
    }
  };
}

test('phase230: faq blocks when top score is below minimum confidence', async () => {
  const result = await answerFaqFromKb(
    { question: '会員番号を確認したい', locale: 'ja' },
    baseDeps([
      { id: 'a1', title: '会員番号', body: '確認', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 1.15 },
      { id: 'a2', title: '会員番号', body: '更新', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 0.95 }
    ])
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'low_confidence');
});

test('phase230: faq blocks when top1/top2 ratio is below threshold', async () => {
  const result = await answerFaqFromKb(
    { question: '会員番号を確認したい', locale: 'ja' },
    baseDeps([
      { id: 'a1', title: '会員番号', body: '確認', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 2.0 },
      { id: 'a2', title: '会員番号', body: '更新', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 1.9 }
    ])
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'low_confidence');
});

test('phase230: faq allows confident candidates to proceed', async () => {
  const result = await answerFaqFromKb(
    { question: '会員番号を確認したい', locale: 'ja' },
    baseDeps([
      { id: 'a1', title: '会員番号', body: '確認', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 3.0 },
      { id: 'a2', title: '会員番号', body: '更新', tags: [], riskLevel: 'low', linkRegistryIds: ['l1'], searchScore: 1.5 }
    ])
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.httpStatus, 200);
  assert.strictEqual(result.blockedReason, null);
});
