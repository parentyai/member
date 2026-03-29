'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { applyAnswerReadinessDecision } = require('../../src/domain/llm/quality/applyAnswerReadinessDecision');
const { finalizeCandidate } = require('../../src/domain/llm/orchestrator/finalizeCandidate');
const {
  selectConversationStyle
} = require('../../src/domain/llm/conversation/styleRouter');
const {
  composeConversationDraftFromSignals
} = require('../../src/domain/llm/conversation/conversationComposer');
const {
  humanizeConversationMessage
} = require('../../src/domain/llm/conversation/styleHumanizer');
const {
  buildOverflowFallbackMessage
} = require('../../src/v1/line_renderer/fallbackRenderer');
const { prepareLineMessages } = require('../../src/v1/line_renderer/lineChannelRenderer');
const { WELCOME_TEXT } = require('../../src/usecases/notifications/sendWelcomeMessage');
const { feedbackReceived } = require('../../src/domain/cityPackFeedbackMessages');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function buildObservedLowRelevanceClarify(questionText) {
  const question = typeof questionText === 'string' ? questionText.trim() : '';
  const draftPacket = composeConversationDraftFromSignals({
    summary: 'いまの質問だけでは対象手続きを特定できません。',
    nextActions: [
      '対象手続きを1つ指定する（例: ビザ更新 / 住居契約 / 税務）',
      '期限を1つ添える（例: 1週間後）'
    ],
    pitfall: '対象手続きと期限が曖昧なまま進めると、案内の精度が下がります。',
    question: '対象手続き名と期限を1つずつ教えてください。',
    state: 'CLARIFY',
    move: 'Narrow'
  });
  const styleDecision = Object.assign({}, selectConversationStyle({
    topic: 'general',
    question,
    userTier: 'paid',
    journeyPhase: 'pre',
    messageLength: question.length,
    timeOfDay: 9,
    urgency: 'high'
  }), {
    askClarifying: true,
    maxActions: 2
  });
  return humanizeConversationMessage({ draftPacket, styleDecision }).text;
}

test('phase860: paid readiness defaults keep exact clarify/refuse/hedge strings and text output shape', () => {
  const clarify = applyAnswerReadinessDecision({ decision: 'clarify', replyText: 'unused' });
  const refuse = applyAnswerReadinessDecision({ decision: 'refuse', replyText: 'unused' });
  const hedged = applyAnswerReadinessDecision({ decision: 'hedged', replyText: '現在の整理です。' });

  assert.deepEqual(clarify, {
    decision: 'clarify',
    replyText: 'まず対象手続きと期限を1つずつ教えてください。そこから案内を具体化します。',
    enforced: true
  });
  assert.deepEqual(refuse, {
    decision: 'refuse',
    replyText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを一緒に整理します。',
    enforced: true
  });
  assert.deepEqual(hedged, {
    decision: 'hedged',
    replyText: '現在の整理です。\n\n補足: 情報は更新されるため、最終確認をお願いします。',
    enforced: true
  });
});

test('phase860: paid finalizer fallback and refuse outputs stay exact without wording drift', () => {
  const finalizeSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js');
  const fallback = finalizeCandidate({
    selected: { replyText: '' },
    readinessDecision: 'allow'
  });
  const refuse = finalizeCandidate({
    selected: { replyText: '' },
    readinessDecision: 'refuse'
  });

  assert.ok(finalizeSource.includes("|| '状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。';"));
  assert.equal(fallback.finalMeta.readinessDecision, 'allow');
  assert.equal(typeof fallback.replyText, 'string');
  assert.equal(fallback.replyText, '状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。');

  assert.ok(finalizeSource.includes("getMinSafeApplyLiteral('leaf_paid_finalizer_refuse'"));
  assert.ok(finalizeSource.includes('この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。'));
  assert.equal(refuse.replyText, 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。');
  assert.equal(refuse.finalMeta.readinessDecision, 'refuse');
});

test('phase860: webhook top-level fallback and fixed ack strings remain anchored to current source', () => {
  const source = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_guard_missing_reply_fallback'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_retrieval_failure_fallback'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_readiness_clarify'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_readiness_refuse'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_synthetic_ack'"));
  assert.ok(source.includes('状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。'));
  assert.ok(source.includes('関連情報を取得できませんでした。'));
  assert.ok(source.includes('まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。'));
  assert.ok(source.includes('この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。'));
  assert.ok(source.includes('受け取りました。続けて状況を一緒に整理します。'));
});

test('phase860: webhook low relevance clarify composition stays exact for the observed signal set', () => {
  const message = buildObservedLowRelevanceClarify('どこから始めればいい？');
  assert.equal(message, [
    'いまの質問だけでは対象手続きを特定できません。',
    'まずこの順です。',
    '1. 対象手続きを1つ指定する（例: ビザ更新 / 住居契約 / 税務）',
    '2. 期限を1つ添える（例: 1週間後）',
    'つまずきやすい点: 対象手続きと期限が曖昧なまま進めると、案内の精度が下がります。',
    '確認: 対象手続き名と期限を1つずつ教えてください。'
  ].join('\n'));
});

test('phase860: line renderer fallback texts keep overflow, generic deeplink, and render failure contracts', () => {
  const overflow = buildOverflowFallbackMessage({});
  const prepared = prepareLineMessages([
    { type: 'text', text: '1' },
    { type: 'text', text: '2' },
    { type: 'text', text: '3' },
    { type: 'text', text: '4' },
    { type: 'text', text: '5' },
    { type: 'text', text: '6' }
  ]);
  const empty = prepareLineMessages([]);

  assert.deepEqual(overflow, {
    type: 'text',
    text: '表示できる件数を超えたため要約して案内します。続きはアプリ内画面で確認できます。'
  });
  assert.equal(prepared.length, 5);
  assert.deepEqual(prepared[4], overflow);
  assert.deepEqual(empty, [{ type: 'text', text: 'メッセージを生成できませんでした。' }]);
});

test('phase860: welcome and citypack literals stay exact for their current runtime helpers', () => {
  const webhookSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

  assert.equal(WELCOME_TEXT, '公式からのご案内はすべてこちらのLINEでお送りします。重要なお知らせは「公式連絡」からご確認ください。');
  assert.equal(feedbackReceived(), 'City Packの誤り報告を受け付けました。確認後に反映します。');
  assert.ok(webhookSource.includes("if (feedback.status === 'received')"));
  assert.ok(webhookSource.includes('buildCityPackFeedbackReceivedText()'));
});
