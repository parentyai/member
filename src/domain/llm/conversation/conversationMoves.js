'use strict';

const { CONVERSATION_STATES } = require('./conversationState');

const CONVERSATION_MOVES = Object.freeze({
  MIRROR: 'Mirror',
  NARROW: 'Narrow',
  PRIORITIZE: 'Prioritize',
  UNBLOCK: 'Unblock',
  CHUNK: 'Chunk',
  OFFER: 'Offer',
  VALIDATE: 'Validate',
  HANDOFF: 'Handoff'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveConversationMove(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const state = payload.state;
  const analysis = payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : {};
  const question = normalizeText(payload.question);
  const actionCount = Array.isArray(analysis.nextActions) ? analysis.nextActions.filter(Boolean).length : 0;

  if (state === CONVERSATION_STATES.BLOCKED) return CONVERSATION_MOVES.UNBLOCK;
  if (state === CONVERSATION_STATES.CLARIFY) return CONVERSATION_MOVES.NARROW;
  if (state === CONVERSATION_STATES.CLOSE) return CONVERSATION_MOVES.HANDOFF;
  if (state === CONVERSATION_STATES.EXECUTE) {
    return /(完了|done|終わった|送信した)/i.test(question)
      ? CONVERSATION_MOVES.VALIDATE
      : CONVERSATION_MOVES.CHUNK;
  }
  if (state === CONVERSATION_STATES.PLAN) {
    if (actionCount >= 3) return CONVERSATION_MOVES.PRIORITIZE;
    if (actionCount === 0) return CONVERSATION_MOVES.OFFER;
    return CONVERSATION_MOVES.CHUNK;
  }
  return CONVERSATION_MOVES.MIRROR;
}

module.exports = {
  CONVERSATION_MOVES,
  resolveConversationMove
};
