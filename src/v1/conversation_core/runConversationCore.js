'use strict';

const { resolveConversationState } = require('./conversationStateManager');
const { evaluateRetrievalNeed } = require('../retrieval_and_verification/retrievalController');

function runConversationCore(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const state = resolveConversationState(payload);
  const retrievalDecision = evaluateRetrievalNeed({
    mode: payload.mode,
    intentRiskTier: payload.intentRiskTier,
    retrieveNeeded: payload.retrieveNeeded
  });
  return {
    state,
    retrievalDecision
  };
}

module.exports = {
  runConversationCore
};
