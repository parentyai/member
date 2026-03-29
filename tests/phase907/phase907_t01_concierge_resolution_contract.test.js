'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildResolutionResponse } = require('../../src/domain/llm/concierge/buildResolutionResponse');

test('phase907: resolution response attaches only phase1-safe official links and keeps answer-first ordering', () => {
  const response = buildResolutionResponse({
    lane: 'paid_main',
    baseReplyText: 'SSN申請は、先に本人確認書類をそろえるのが近道です。',
    topic: 'ssn',
    nextSteps: ['必要書類を1つの一覧にまとめる'],
    followUpQuestion: 'いまの在留ステータスを教えてください。',
    officialLinkCandidates: [
      {
        sourceType: 'official',
        title: 'Social Security Administration',
        url: 'https://www.ssa.gov/number-card',
        sourceId: 'ssa_number_card',
        updatedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        sourceType: 'observational_lived_source',
        title: '個人ブログ',
        url: 'https://example-blog.com/ssn',
        sourceId: 'blog_ssn'
      }
    ],
    faqCandidates: [
      {
        articleId: 'faq_ssn_docs',
        title: 'SSN申請で先に見るFAQ',
        linkRegistryIds: ['ssa_number_card']
      }
    ],
    sourceReadinessDecision: 'allow',
    sourceFreshnessScore: 0.92
  });

  assert.equal(response.answer_summary, 'SSN申請は、先に本人確認書類をそろえるのが近道です。');
  assert.equal(response.replyText.split('\n')[0], response.answer_summary);
  assert.equal(response.next_best_action, '必要書類を1つの一覧にまとめる');
  assert.equal(response.follow_up_question, 'いまの在留ステータスを教えてください。');
  assert.equal(response.official_links.length, 1);
  assert.equal(response.official_links[0].url, 'https://www.ssa.gov/number-card');
  assert.equal(response.evidenceRefs.length, 1);
  assert.equal(response.service_surface, 'template');
  assert.equal(response.serviceSurface, 'template');
  assert.equal(Array.isArray(response.templateActions), true);
  assert.equal(response.templateActions[0] && response.templateActions[0].type, 'uri');
  assert.equal(response.templateActions[0] && response.templateActions[0].uri, 'https://www.ssa.gov/number-card');
  assert.match(response.replyText, /公式リンク:/);
  assert.match(response.replyText, /https:\/\/www\.ssa\.gov\/number-card/);
  assert.ok(!response.replyText.includes('https://example-blog.com/ssn'));
  assert.equal(response.menu_hint && response.menu_hint.menu_bucket, 'next_tasks');
  assert.equal(response.quickReplies.length, 1);
});

test('phase907: no-new-facts shaping suppresses links and menu hints when they are not useful', () => {
  const response = buildResolutionResponse({
    lane: 'paid_casual',
    baseReplyText: 'こんにちは。ご状況をうかがいます。',
    topic: 'general'
  });

  assert.equal(response.official_links.length, 0);
  assert.equal(response.next_best_action, null);
  assert.equal(response.menu_hint, null);
  assert.equal(response.quickReplies.length, 0);
  assert.equal(response.service_surface, 'text');
  assert.equal(response.templateActions.length, 0);
  assert.ok(!response.replyText.includes('公式リンク:'));
});
