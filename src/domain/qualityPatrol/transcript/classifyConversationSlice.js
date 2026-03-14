'use strict';

const {
  normalizeText,
  normalizeToken,
  normalizeReviewSlice
} = require('./constants');

function includesToken(value, token) {
  return normalizeText(value).toLowerCase().includes(String(token || '').toLowerCase());
}

function buildResult(slice, sliceReason, sliceSignalsUsed) {
  return {
    slice,
    sliceReason,
    sliceSignalsUsed: Array.isArray(sliceSignalsUsed) ? sliceSignalsUsed.filter(Boolean) : []
  };
}

function classifyConversationSlice(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const genericFallbackSlice = normalizeReviewSlice(payload.genericFallbackSlice);
  if (genericFallbackSlice) {
    return buildResult(
      genericFallbackSlice,
      'generic_fallback_slice',
      [`genericFallbackSlice:${normalizeToken(payload.genericFallbackSlice)}`]
    );
  }

  if (payload.priorContextUsed === true || payload.followupResolvedFromHistory === true) {
    const signals = [];
    if (payload.priorContextUsed === true) signals.push('priorContextUsed:true');
    if (payload.followupResolvedFromHistory === true) signals.push('followupResolvedFromHistory:true');
    return buildResult('follow-up', 'followup_context_signal', signals);
  }

  if (
    payload.cityPackCandidateAvailable === true
    || payload.cityPackUsedInAnswer === true
    || includesToken(payload.knowledgeGroundingKind, 'city')
    || includesToken(payload.selectedCandidateKind, 'city')
    || includesToken(payload.strategyReason, 'city')
  ) {
    const signals = [];
    if (payload.cityPackCandidateAvailable === true) signals.push('cityPackCandidateAvailable:true');
    if (payload.cityPackUsedInAnswer === true) signals.push('cityPackUsedInAnswer:true');
    if (includesToken(payload.knowledgeGroundingKind, 'city')) signals.push(`knowledgeGroundingKind:${normalizeToken(payload.knowledgeGroundingKind)}`);
    if (includesToken(payload.selectedCandidateKind, 'city')) signals.push(`selectedCandidateKind:${normalizeToken(payload.selectedCandidateKind)}`);
    if (includesToken(payload.strategyReason, 'city')) signals.push(`strategyReason:${normalizeToken(payload.strategyReason)}`);
    return buildResult('city', 'city_grounding_signal', signals);
  }

  if (
    normalizeToken(payload.domainIntent) === 'housing'
    || includesToken(payload.strategyReason, 'housing')
    || includesToken(payload.selectedCandidateKind, 'housing')
    || includesToken(payload.knowledgeGroundingKind, 'housing')
  ) {
    const signals = [];
    if (normalizeToken(payload.domainIntent) === 'housing') signals.push('domainIntent:housing');
    if (includesToken(payload.strategyReason, 'housing')) signals.push(`strategyReason:${normalizeToken(payload.strategyReason)}`);
    if (includesToken(payload.selectedCandidateKind, 'housing')) signals.push(`selectedCandidateKind:${normalizeToken(payload.selectedCandidateKind)}`);
    if (includesToken(payload.knowledgeGroundingKind, 'housing')) signals.push(`knowledgeGroundingKind:${normalizeToken(payload.knowledgeGroundingKind)}`);
    return buildResult('housing', 'housing_signal', signals);
  }

  if (
    includesToken(payload.strategyReason, 'broad')
    || includesToken(payload.strategyReason, 'general')
    || (normalizeToken(payload.domainIntent) === 'general' && includesToken(payload.selectedCandidateKind, 'domain_concierge'))
  ) {
    const signals = [];
    if (includesToken(payload.strategyReason, 'broad')) signals.push(`strategyReason:${normalizeToken(payload.strategyReason)}`);
    if (!signals.length && includesToken(payload.strategyReason, 'general')) signals.push(`strategyReason:${normalizeToken(payload.strategyReason)}`);
    if (!signals.length && normalizeToken(payload.domainIntent) === 'general' && includesToken(payload.selectedCandidateKind, 'domain_concierge')) {
      signals.push(`selectedCandidateKind:${normalizeToken(payload.selectedCandidateKind)}`);
    }
    return buildResult('broad', 'broad_strategy_signal', signals);
  }

  return buildResult('other', 'fallback_other', []);
}

module.exports = {
  classifyConversationSlice
};
