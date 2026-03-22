'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  sanitizePaidMainReply,
  containsLegacyTemplateTerms
} = require('../../src/domain/llm/conversation/paidReplyGuard');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function countBullets(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => line.trim().startsWith('・'))
    .length;
}

test('phase720: paid reply guard strips legacy retrieval/template markers and limits atoms', () => {
  const input = [
    '関連情報です。',
    'FAQ候補:',
    '- [ ] FAQ候補を確認する',
    'CityPack候補: New York',
    '根拠キー: kb_123',
    'score=0.8',
    '住まい探しですね。',
    '1. 予算を決める',
    '2. 必要書類を確認する',
    '3. 内見候補を整理する',
    '4. 余分な行動',
    'ここで詰まりやすいのは審査書類です。',
    '希望エリアはどこですか？'
  ].join('\n');

  assert.equal(containsLegacyTemplateTerms(input), true);
  const result = sanitizePaidMainReply(input, {
    maxActions: 3,
    defaultQuestion: '希望エリアを教えてください。'
  });

  assert.equal(result.legacyTemplateHit, true);
  assert.equal(result.text.includes('FAQ候補'), false);
  assert.equal(result.text.includes('CityPack候補'), false);
  assert.equal(result.text.includes('根拠キー'), false);
  assert.equal(result.text.includes('根拠:'), false);
  assert.equal(result.text.includes('score='), false);
  assert.equal(result.text.includes('- [ ]'), false);
  assert.equal(result.text.includes('関連情報です'), false);
  assert.equal(countBullets(result.text) <= 3, true);
  assert.equal(result.actionCount <= 3, true);
  assert.equal(result.pitfallIncluded === true || result.pitfallIncluded === false, true);
  assert.equal(result.followupQuestionIncluded === true || result.followupQuestionIncluded === false, true);
});

test('phase720: paid webhook path keeps free retrieval out of blocked fallback branches', () => {
  const source = read('src/routes/webhookLine.js');
  assert.ok(source.includes('forceConcierge: true'));
  assert.ok(source.includes('domainIntent: isPaidDomainIntent ? normalizedConversationIntent : \'general\''));
  assert.ok(source.includes('routerReason: routerReason || \'paid_fallback_concierge\''));
  assert.ok(source.includes('conversationMode: \'concierge\''));
  assert.ok(source.includes('forceConversationFormat: true'));
  assert.ok(source.includes('guardPaidMainReplyText('));
  assert.equal(source.includes('shouldFallbackToFree'), false);
});

test('phase720: paid reply guard suppresses repeated followup question when repetition prevention is active', () => {
  const result = sanitizePaidMainReply([
    '了解です。状況を短く整理しながら進めます。',
    '優先したい手続きがあれば1つだけ教えてください。'
  ].join('\n'), {
    conciseMode: true,
    repetitionPrevented: true,
    recentAssistantCommitments: ['優先したい手続きがあれば1つだけ教えてください。'],
    defaultQuestion: '対象を絞って案内したいので、いま一番気になっている手続きを1つ教えてください。'
  });

  assert.equal(result.text.includes('優先したい手続きがあれば1つだけ教えてください。'), false);
  assert.equal(result.text.includes('対象を絞って案内したいので'), true);
  assert.equal(result.followupQuestionIncluded, true);
});

test('phase720: paid reply guard normalizes mixed punctuation drift', () => {
  const result = sanitizePaidMainReply([
    '学校手続きですね。',
    '次は学区と対象校の条件を確認する。',
    '学年と希望エリアが分かれば、次の一手を具体化できます。？'
  ].join('\n'), {
    conciseMode: false,
    defaultQuestion: ''
  });

  assert.equal(result.text.includes('。？'), false);
  assert.equal(result.text.includes('？。'), false);
  assert.match(result.text, /次の一手を具体化できます？/);
});
