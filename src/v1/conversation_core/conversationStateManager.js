'use strict';

function resolveConversationState(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const mode = typeof payload.mode === 'string' ? payload.mode : 'casual';
  return {
    mode,
    turnId: payload.turnId || null,
    intent: payload.intent || 'general',
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  resolveConversationState
};
