'use strict';

const { detectMessagePosture } = require('../../../usecases/assistant/opportunity/detectMessagePosture');
const { normalizeConversationIntent } = require('./normalizeConversationIntent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function looksLikeQuestion(text) {
  if (!text) return false;
  if (/[?？]$/.test(text)) return true;
  return /(どう|なに|何|いつ|どこ|どれ|どの|できますか|教えて|知りたい|方法|次の行動|次アクション|整理して|進め方|優先順位)/.test(text);
}

function detectIntent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const posture = detectMessagePosture({ messageText });
  const normalizedIntent = normalizeConversationIntent(messageText);

  if (normalizedIntent !== 'general') {
    return {
      mode: 'problem',
      reason: `${normalizedIntent}_intent_detected`,
      posture
    };
  }

  if (posture.isGreeting) {
    return {
      mode: 'greeting',
      reason: 'greeting_detected',
      posture
    };
  }

  if (posture.isSmalltalk) {
    return {
      mode: 'casual',
      reason: 'smalltalk_detected',
      posture
    };
  }

  if (posture.keywordHits && posture.keywordHits.blocked) {
    return {
      mode: 'problem',
      reason: 'blocked_signal',
      posture
    };
  }

  if (posture.keywordHits && posture.keywordHits.life) {
    return {
      mode: 'activity',
      reason: 'life_signal',
      posture
    };
  }

  if (posture.keywordHits && posture.keywordHits.action) {
    return {
      mode: 'question',
      reason: 'action_keyword',
      posture
    };
  }

  if (looksLikeQuestion(messageText)) {
    return {
      mode: 'question',
      reason: 'question_pattern',
      posture
    };
  }

  return {
    mode: 'casual',
    reason: 'default_casual',
    posture
  };
}

module.exports = {
  detectIntent
};
