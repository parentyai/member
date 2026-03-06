'use strict';

const HOUSING_INTENT_PATTERN = /(家探し|住宅|部屋探し|賃貸|lease|apartment)/i;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeConversationIntent(messageText) {
  const normalized = normalizeText(messageText);
  if (!normalized) return 'general';
  if (HOUSING_INTENT_PATTERN.test(normalized)) return 'housing';
  return 'general';
}

module.exports = {
  normalizeConversationIntent,
  HOUSING_INTENT_PATTERN
};
