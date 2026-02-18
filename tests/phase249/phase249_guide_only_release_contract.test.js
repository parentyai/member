'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');

function baseDeps() {
  return {
    env: { LLM_FEATURE_FLAG: 'true' },
    getLlmEnabled: async () => true,
    getLlmPolicy: async () => ({ lawfulBasis: 'contract', consentVerified: false, crossBorder: false }),
    faqArticlesRepo: {
      searchActiveArticles: async () => ([
        {
          id: 'faq-1',
          title: '会員番号の確認方法',
          body: '会員ページで確認',
          tags: ['faq'],
          riskLevel: 'low',
          linkRegistryIds: ['lk_faq'],
          status: 'active',
          validUntil: new Date('2026-12-31T00:00:00Z'),
          allowedIntents: ['FAQ'],
          disclaimerVersion: 'faq_disclaimer_v1',
          version: '1.0.0',
          versionSemver: '1.0.0',
          searchScore: 2.0
        }
      ])
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
        }
      })
    },
    linkRegistryRepo: {
      getLink: async () => ({ id: 'lk_faq', lastHealth: { state: 'OK' } })
    },
    appendAuditLog: async () => ({ id: 'audit-249' })
  };
}

test('phase249: guide-only modes remain allowed', async () => {
  const modes = ['faq_navigation', 'question_refine', 'checklist_guidance'];
  for (const mode of modes) {
    const result = await answerFaqFromKb(
      {
        question: '会員番号の確認方法',
        guideMode: mode,
        personalization: { locale: 'ja', servicePhase: 2 }
      },
      baseDeps()
    );
    assert.strictEqual(result.ok, true, `mode=${mode}`);
  }
});

test('phase249: non guide-only mode is blocked', async () => {
  const result = await answerFaqFromKb(
    {
      question: '会員番号の確認方法',
      guideMode: 'free_chat'
    },
    baseDeps()
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'guide_only_mode_blocked');
});

test('phase249: personalization is restricted to locale/servicePhase', async () => {
  const result = await answerFaqFromKb(
    {
      question: '会員番号の確認方法',
      guideMode: 'faq_navigation',
      personalization: { locale: 'ja', servicePhase: 2, behaviorProfile: 'vip' }
    },
    baseDeps()
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'personalization_not_allowed');
});
