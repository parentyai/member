'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildCandidatePriorityContext(packet) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const domainIntent = normalizeText(payload.normalizedConversationIntent).toLowerCase() || 'general';
  const genericFallbackSlice = normalizeText(payload.genericFallbackSlice).toLowerCase() || 'other';
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  return {
    domainIntent,
    genericFallbackSlice,
    priorContextUsed: payload.priorContextUsed === true,
    followupIntent,
    followupResolvedFromHistory: payload.followupResolvedFromHistory === true
  };
}

function resolveCandidatePriority(packet, candidate) {
  const context = buildCandidatePriorityContext(packet);
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const kind = normalizeText(payload.kind).toLowerCase();

  if (kind === 'city_pack_backed_candidate') return 110;
  if (kind === 'city_grounded_candidate') return 105;
  if (kind === 'continuation_candidate') {
    return context.priorContextUsed || context.followupResolvedFromHistory ? 103 : 92;
  }
  if (kind === 'grounded_candidate') return 98;
  if (kind === 'structured_answer_candidate') {
    return context.genericFallbackSlice === 'broad' || context.genericFallbackSlice === 'followup' ? 95 : 90;
  }
  if (kind === 'knowledge_backed_candidate' || kind === 'housing_knowledge_candidate' || kind === 'saved_faq_candidate') return 89;
  if (kind === 'composed_concierge_candidate') return 88;
  if (kind === 'domain_concierge_candidate') {
    if (context.domainIntent === 'ssn' || context.domainIntent === 'banking') return 84;
    return context.followupIntent ? 78 : 72;
  }
  if (kind === 'clarify_candidate') return 48;
  if (kind === 'conversation_candidate' || kind === 'casual_candidate') return 30;
  if (kind === 'refuse_candidate') return 12;
  return 24;
}

function isDirectAnswerEligibleCandidate(packet, candidate) {
  const context = buildCandidatePriorityContext(packet);
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const kind = normalizeText(payload.kind).toLowerCase();
  if (payload.directAnswerCandidate === true) return true;
  if (kind === 'continuation_candidate') return true;
  if (context.followupIntent || context.priorContextUsed || context.followupResolvedFromHistory) {
    return kind === 'grounded_candidate'
      || kind === 'city_grounded_candidate'
      || kind === 'city_pack_backed_candidate'
      || kind === 'structured_answer_candidate'
      || kind === 'knowledge_backed_candidate'
      || kind === 'saved_faq_candidate'
      || kind === 'housing_knowledge_candidate';
  }
  return false;
}

function resolveFallbackPriorityReason(packet, selected, candidates) {
  const context = buildCandidatePriorityContext(packet);
  const current = selected && typeof selected === 'object' ? selected : null;
  const rows = Array.isArray(candidates) ? candidates : [];
  if (!current) return 'no_candidate_selected';

  const selectedKind = normalizeText(current.kind).toLowerCase();
  const hasGrounded = rows.some((row) => {
    const kind = normalizeText(row && row.kind).toLowerCase();
    return kind === 'grounded_candidate' || kind === 'city_grounded_candidate' || kind === 'city_pack_backed_candidate';
  });
  const hasStructured = rows.some((row) => normalizeText(row && row.kind).toLowerCase() === 'structured_answer_candidate');
  const hasContinuation = rows.some((row) => normalizeText(row && row.kind).toLowerCase() === 'continuation_candidate');
  const hasDomainConcierge = rows.some((row) => normalizeText(row && row.kind).toLowerCase() === 'domain_concierge_candidate');
  const hasClarify = rows.some((row) => normalizeText(row && row.kind).toLowerCase() === 'clarify_candidate');

  if (selectedKind === 'continuation_candidate') return 'prefer_continuation_from_history';
  if (selectedKind === 'city_pack_backed_candidate') return 'prefer_city_pack_grounding';
  if (selectedKind === 'city_grounded_candidate') return 'prefer_city_grounding';
  if (selectedKind === 'grounded_candidate') return hasDomainConcierge ? 'prefer_grounded_over_domain_concierge' : 'prefer_grounded_answer';
  if (selectedKind === 'structured_answer_candidate') return hasClarify ? 'prefer_structured_over_clarify' : 'prefer_structured_answer';
  if (selectedKind === 'housing_knowledge_candidate') return 'prefer_housing_knowledge_activation';
  if (selectedKind === 'knowledge_backed_candidate') return 'prefer_runtime_knowledge_activation';
  if (selectedKind === 'saved_faq_candidate') return 'prefer_saved_faq_activation';
  if (selectedKind === 'domain_concierge_candidate') {
    if (context.domainIntent === 'ssn' || context.domainIntent === 'banking') return 'preserve_high_risk_domain_concierge';
    if (!hasGrounded && !hasStructured && !hasContinuation) return 'fallback_to_domain_concierge_after_grounding_probe';
    return 'domain_concierge_after_higher_priority_unavailable';
  }
  if (selectedKind === 'clarify_candidate') {
    if (!hasGrounded && !hasStructured && !hasContinuation && !hasDomainConcierge) return 'clarify_after_no_grounding_footing';
    return 'clarify_after_all_higher_priority_candidates_failed';
  }
  if (selectedKind === 'casual_candidate' || selectedKind === 'conversation_candidate') return 'fallback_to_casual_after_strategy_constraints';
  return 'selected_best_available_candidate';
}

module.exports = {
  resolveCandidatePriority,
  isDirectAnswerEligibleCandidate,
  resolveFallbackPriorityReason
};
