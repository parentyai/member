'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps(overrides) {
  return Object.assign({
    appendAuditLog: async () => ({ id: 'audit-1' }),
    faqAnswerLogsRepo: { appendFaqAnswerLog: async () => ({ id: 'faq-log-1' }) },
    getLlmEnabled: async () => true,
    env: { LLM_FEATURE_FLAG: 'true' },
    faqArticlesRepo: { searchActiveArticles: async () => [] }
  }, overrides || {});
}

test('phase232: faq blocked payload includes category/actions/suggestions for kb_no_match', async () => {
  const result = await answerFaqFromKb(
    { question: '会員番号の確認方法', locale: 'ja' },
    baseDeps()
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.httpStatus, 422);
  assert.strictEqual(result.blockedReason, 'kb_no_match');
  assert.strictEqual(result.blockedReasonCategory, 'NO_KB_MATCH');
  assert.deepStrictEqual(result.fallbackActions, []);
  assert.deepStrictEqual(result.suggestedFaqs, []);
});

test('phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs', async () => {
  const result = await answerFaqFromKb(
    { question: '手続き', locale: 'ja' },
    baseDeps({
      faqArticlesRepo: {
        searchActiveArticles: async () => ([
          {
            id: 'faq-1',
            title: '会員番号の確認',
            body: '確認方法',
            tags: ['member'],
            riskLevel: 'high',
            linkRegistryIds: ['lk_faq', 'lk_contact'],
            status: 'active',
            allowedIntents: ['FAQ'],
            searchScore: 1.0
          },
          {
            id: 'faq-2',
            title: '氏名変更',
            body: '変更方法',
            tags: ['profile'],
            riskLevel: 'low',
            linkRegistryIds: ['lk_other'],
            status: 'active',
            allowedIntents: ['FAQ'],
            searchScore: 0.8
          },
          {
            id: 'faq-3',
            title: '引き落とし確認',
            body: '確認方法',
            tags: ['billing'],
            riskLevel: 'low',
            linkRegistryIds: ['https://example.com/not-allowed'],
            status: 'active',
            allowedIntents: ['FAQ'],
            searchScore: 0.4
          },
          {
            id: 'faq-4',
            title: 'その他',
            body: 'その他',
            tags: ['other'],
            riskLevel: 'low',
            linkRegistryIds: ['lk_4'],
            status: 'active',
            allowedIntents: ['FAQ'],
            searchScore: 0.2
          }
        ])
      }
    })
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'low_confidence');
  assert.strictEqual(result.blockedReasonCategory, 'LOW_CONFIDENCE');
  assert.ok(Array.isArray(result.fallbackActions));
  assert.deepStrictEqual(result.fallbackActions, [
    { actionKey: 'open_official_faq', label: '公式FAQを見る', sourceId: 'lk_faq' },
    { actionKey: 'open_contact', label: '問い合わせる', sourceId: 'lk_contact' }
  ]);
  assert.ok(Array.isArray(result.suggestedFaqs));
  assert.strictEqual(result.suggestedFaqs.length, 3);
  assert.deepStrictEqual(result.suggestedFaqs[0], { articleId: 'faq-1', title: '会員番号の確認' });
  assert.deepStrictEqual(result.suggestedFaqs[2], { articleId: 'faq-3', title: '引き落とし確認' });
});
