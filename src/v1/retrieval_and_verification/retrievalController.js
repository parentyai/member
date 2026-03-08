'use strict';

function evaluateRetrievalNeed(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const mode = payload.mode || 'casual';
  if (mode === 'greeting' || mode === 'casual') return { retrieveNeeded: false, reason: 'conversation_mode_no_retrieval' };
  if (payload.intentRiskTier === 'high') return { retrieveNeeded: true, reason: 'high_risk_requires_grounding' };
  return { retrieveNeeded: payload.retrieveNeeded !== false, reason: 'default_retrieval_policy' };
}

module.exports = {
  evaluateRetrievalNeed
};
