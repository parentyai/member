'use strict';

const { detectIntent } = require('./detectIntent');

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function routeConversation(message, context) {
  const payload = context && typeof context === 'object' ? context : {};
  const intent = detectIntent({ messageText: message });
  const llmConciergeEnabled = normalizeBoolean(payload.llmConciergeEnabled, false);
  const forceConcierge = /_intent_detected$/.test(intent.reason || '');

  const conversationMode = intent.mode === 'problem' && (llmConciergeEnabled || forceConcierge)
    ? 'concierge'
    : 'casual';

  return {
    mode: intent.mode,
    reason: intent.reason,
    conversationMode
  };
}

module.exports = {
  routeConversation
};
