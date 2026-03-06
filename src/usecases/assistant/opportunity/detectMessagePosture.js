'use strict';

const { detectConversationIntentHits } = require('../../../domain/llm/router/normalizeConversationIntent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

const GREETING_PATTERN = /(こんにちは|こんばんは|おはよう|はじめまして|よろしく|hello|hi|hey|やあ|どうも|お疲れ)/i;
const SMALLTALK_PATTERN = /(元気|調子|雑談|ありがとう|サンキュー|thanks|眠い|疲れた|天気|ランチ|お昼)/i;
const ACTION_KEYWORD_PATTERN = /(学校|school|ssn|住居|住宅|家探し|賃貸|税|tax|保険|年金|口座|銀行|手続き|期限|いつまで|申請|更新|予約|面談|ワクチン)/i;
const BLOCKED_KEYWORD_PATTERN = /(詰ま|進まない|できない|わからない|失敗|エラー|blocked|stuck|遅れ|遅延|間に合わない)/i;
const LIFE_KEYWORD_PATTERN = /(週末|weekend|移動|引越|帰任|帰国|出張|旅行|vacation|休日|土日)/i;

function detectMessagePosture(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const lowered = messageText.toLowerCase();
  const domainHits = detectConversationIntentHits(messageText);

  const isGreeting = Boolean(messageText && GREETING_PATTERN.test(messageText));
  const keywordHits = {
    action: Boolean(messageText && ACTION_KEYWORD_PATTERN.test(messageText)),
    blocked: Boolean(messageText && BLOCKED_KEYWORD_PATTERN.test(messageText)),
    life: Boolean(messageText && LIFE_KEYWORD_PATTERN.test(messageText)),
    housing: domainHits.housing === true,
    school: domainHits.school === true,
    ssn: domainHits.ssn === true,
    banking: domainHits.banking === true
  };
  const isSmalltalk = Boolean(
    messageText
    && SMALLTALK_PATTERN.test(messageText)
    && !keywordHits.action
    && !keywordHits.blocked
    && !keywordHits.life
  );

  return {
    normalizedText: lowered,
    isGreeting,
    isSmalltalk,
    keywordHits,
    messageLength: messageText.length
  };
}

module.exports = {
  detectMessagePosture
};
