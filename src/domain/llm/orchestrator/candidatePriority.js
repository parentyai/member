'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildCandidatePriorityContext(packet) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const messageText = normalizeText(payload.messageText);
  const domainIntent = normalizeText(payload.normalizedConversationIntent).toLowerCase() || 'general';
  const genericFallbackSlice = normalizeText(payload.genericFallbackSlice).toLowerCase() || 'other';
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const requestShape = normalizeText(payload.requestShape || (payload.requestContract && payload.requestContract.requestShape)).toLowerCase() || 'answer';
  const outputForm = normalizeText(payload.outputForm || (payload.requestContract && payload.requestContract.outputForm)).toLowerCase() || 'default';
  const knowledgeScope = normalizeText(payload.knowledgeScope || (payload.requestContract && payload.requestContract.knowledgeScope)).toLowerCase() || 'none';
  const locationHintKind = normalizeText(
    payload.locationHintKind
      || (payload.locationHint && payload.locationHint.kind)
      || (payload.requestContract && payload.requestContract.locationHint && payload.requestContract.locationHint.kind)
  ).toLowerCase() || 'none';
  const servicePlanQuestion = /(無料プラン|有料プラン|プランの違い|プラン.*違い|料金.*違い|プラン比較|subscription|plan)/i.test(messageText);
  const generalSetupQuestion = /(赴任|引っ越し|引越し|移住|生活セットアップ|生活立ち上げ).*(何から始め|最初にやるべき|最初に何|順番|ざっくり)/i.test(messageText);
  const utilityTransformQuestion = /(家族に送れる一文|家族に送れる|一文にして|今日やること.*1行|今日やること.*一行|1行にして|一行にして|不安が強い前提|不安が強い.*1つだけ|不安が強い.*一つだけ|公式情報を確認すべき場面|判断基準だけ|失礼なく聞く短文|短文を1つ作って|断定せずに提案|相手に送る文面だけ|文面だけ|断定しすぎない|言い方に直して|人に話す感じ|2文にして|二文にして|事務的すぎない|何を確認すべきかだけ|地域によって違う)/i.test(messageText);
  const cityScopedDirectAnswer = requestShape === 'answer'
    && domainIntent !== 'general'
    && (knowledgeScope === 'city' || locationHintKind === 'city');
  return {
    domainIntent,
    genericFallbackSlice,
    priorContextUsed: payload.priorContextUsed === true,
    followupIntent,
    followupResolvedFromHistory: payload.followupResolvedFromHistory === true,
    requestShape,
    outputForm,
    knowledgeScope,
    locationHintKind,
    cityScopedDirectAnswer,
    servicePlanQuestion,
    generalSetupQuestion,
    utilityTransformQuestion
  };
}

function resolveCandidatePriority(packet, candidate) {
  const context = buildCandidatePriorityContext(packet);
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const kind = normalizeText(payload.kind).toLowerCase();
  const broadSetupDirectAnswer = context.domainIntent === 'general'
    && context.generalSetupQuestion === true
    && !context.followupIntent
    && context.requestShape === 'answer';
  const cityScopedDirectAnswer = context.cityScopedDirectAnswer === true;
  const followupContextPreferred = context.genericFallbackSlice === 'followup'
    || context.priorContextUsed
    || context.followupResolvedFromHistory
    || Boolean(context.followupIntent);
  const generalDirectAnswerPreferred = context.domainIntent === 'general'
    && (
      Boolean(context.followupIntent)
      || context.servicePlanQuestion
      || context.utilityTransformQuestion
      || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction', 'followup_continue'].includes(context.requestShape)
    );
  const formatLocked = context.outputForm !== 'default'
    || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction'].includes(context.requestShape);

  if (kind === 'city_pack_backed_candidate') return 120;
  if (kind === 'city_grounded_candidate') return 115;
  if (kind === 'saved_faq_candidate' && cityScopedDirectAnswer) return 96;
  if (kind === 'saved_faq_candidate' && followupContextPreferred) return 88;
  if (kind === 'saved_faq_candidate' && generalDirectAnswerPreferred) return 92;
  if (kind === 'saved_faq_candidate') return 110;
  if ((kind === 'knowledge_grounded_candidate' || kind === 'knowledge_backed_candidate' || kind === 'housing_knowledge_candidate') && cityScopedDirectAnswer) return 94;
  if ((kind === 'knowledge_grounded_candidate' || kind === 'knowledge_backed_candidate' || kind === 'housing_knowledge_candidate') && followupContextPreferred) return 89;
  if ((kind === 'knowledge_grounded_candidate' || kind === 'knowledge_backed_candidate' || kind === 'housing_knowledge_candidate') && generalDirectAnswerPreferred) return 90;
  if (kind === 'knowledge_grounded_candidate' || kind === 'knowledge_backed_candidate' || kind === 'housing_knowledge_candidate') return 106;
  if (kind === 'grounded_candidate') return broadSetupDirectAnswer ? 98 : 102;
  if (kind === 'structured_answer_candidate') {
    if (formatLocked) return 94;
    if (broadSetupDirectAnswer) return 96;
    return context.genericFallbackSlice === 'broad' || context.genericFallbackSlice === 'followup' ? 100 : 96;
  }
  if (kind === 'continuation_candidate') {
    if (formatLocked) return 118;
    if (generalDirectAnswerPreferred) return 114;
    return context.priorContextUsed || context.followupResolvedFromHistory ? 94 : 90;
  }
  if (kind === 'composed_concierge_candidate') return 88;
  if (kind === 'domain_concierge_candidate') {
    if (formatLocked) return 116;
    if (cityScopedDirectAnswer) return 112;
    if (broadSetupDirectAnswer) return 104;
    if (generalDirectAnswerPreferred) return 112;
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
  const broadSetupDirectAnswer = context.domainIntent === 'general'
    && context.generalSetupQuestion === true
    && !context.followupIntent
    && context.requestShape === 'answer';
  const generalDirectAnswerPreferred = context.domainIntent === 'general'
    && (
      Boolean(context.followupIntent)
      || context.servicePlanQuestion
      || context.utilityTransformQuestion
      || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction', 'followup_continue'].includes(context.requestShape)
    );
  const formatLocked = context.outputForm !== 'default'
    || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction'].includes(context.requestShape);
  if (payload.directAnswerCandidate === true) return true;
  if (kind === 'continuation_candidate') return true;
  if (formatLocked) {
    return kind === 'domain_concierge_candidate'
      || kind === 'continuation_candidate'
      || kind === 'structured_answer_candidate';
  }
  if (broadSetupDirectAnswer) {
    return kind === 'domain_concierge_candidate'
      || kind === 'grounded_candidate'
      || kind === 'structured_answer_candidate'
      || kind === 'knowledge_backed_candidate'
      || kind === 'saved_faq_candidate'
      || kind === 'housing_knowledge_candidate';
  }
  if (generalDirectAnswerPreferred) {
    return kind === 'domain_concierge_candidate'
      || kind === 'grounded_candidate'
      || kind === 'structured_answer_candidate';
  }
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
