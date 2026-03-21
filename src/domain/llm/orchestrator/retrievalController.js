'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function hasPattern(text, pattern) {
  return Boolean(text && pattern && pattern.test(text));
}

function isHighRiskDomain(domainIntent) {
  const normalized = normalizeText(domainIntent).toLowerCase();
  return normalized === 'ssn' || normalized === 'banking';
}

function detectBroadGroundingSignals(messageText) {
  const normalized = normalizeText(messageText);
  return {
    costQuestion: hasPattern(normalized, /(いくら|どのくらい.*(お金|費用|コスト)|費用|初期費用|生活費|家賃相場|予算|相場)/i),
    timelineQuestion: hasPattern(normalized, /(いつ|どのタイミング|タイミング|いつまで|期限|スケジュール|何日前|到着後|出国前)/i),
    checklistQuestion: hasPattern(normalized, /(何から|まず何|最初に|準備|チェックリスト|段取り|流れ|手順|どう進める)/i),
    relocationQuestion: hasPattern(normalized, /(引っ越し|引越し|転居|移住|赴任先|生活立ち上げ|住みやすさ|家賃|初期費用|生活で最初に困る|暮らし|生活費|relocation|move|moving)/i)
  };
}

function resolveRetrievalDecision(packet, strategyPlan) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const plan = strategyPlan && typeof strategyPlan === 'object' ? strategyPlan : {};
  const strategy = normalizeText(plan.strategy).toLowerCase();
  const fallbackType = normalizeText(plan.fallbackType).toLowerCase();
  const domainIntent = normalizeText(payload.normalizedConversationIntent).toLowerCase() || 'general';
  const requestShape = normalizeText(payload.requestShape || (payload.requestContract && payload.requestContract.requestShape)).toLowerCase();
  const genericFallbackSlice = normalizeText(payload.genericFallbackSlice).toLowerCase() || 'other';
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const messageText = normalizeText(payload.messageText);
  const broadSignals = detectBroadGroundingSignals(messageText);
  const strategyReason = normalizeText(plan.strategyReason).toLowerCase();
  const blockedByDefault = !strategy
    || strategy === 'casual'
    || strategy === 'clarify'
    || strategy === 'domain_concierge'
    || strategy === 'concierge';
  const preserveDirectAnswerFallback = fallbackType === 'general_followup_direct_answer'
    || fallbackType === 'service_plan_direct_answer'
    || fallbackType === 'utility_transform_direct_answer'
    || fallbackType === 'followup_direct_answer'
    || fallbackType === 'history_followup_carry'
    || fallbackType === 'mixed_domain_direct_answer';
  const requestShapeDirectAnswer = [
    'compare',
    'correction',
    'rewrite',
    'summarize',
    'message_template',
    'criteria',
    'followup_continue'
  ].includes(requestShape);
  const blockedStrategies = new Set(['casual', 'clarify', 'domain_concierge', 'concierge']);
  const continuationContext = payload.priorContextUsed === true
    || payload.contextResume === true
    || payload.followupResolvedFromHistory === true
    || Boolean(followupIntent);
  const broadQuestion = genericFallbackSlice === 'broad'
    || broadSignals.costQuestion === true
    || broadSignals.timelineQuestion === true
    || broadSignals.checklistQuestion === true;
  const housingGrounding = (domainIntent === 'housing' || genericFallbackSlice === 'housing')
    && strategyReason === 'explicit_domain_grounded_answer';
  const cityGrounding = genericFallbackSlice === 'city'
    || broadSignals.relocationQuestion === true;
  const explicitDomainGrounding = strategyReason === 'explicit_domain_grounded_answer'
    && domainIntent !== 'general';
  const broadGrounding = genericFallbackSlice === 'broad'
    && (broadSignals.costQuestion || broadSignals.timelineQuestion || broadSignals.checklistQuestion);
  const followupGrounding = genericFallbackSlice === 'followup'
    && continuationContext
    && domainIntent !== 'general';
  const highRiskDomain = isHighRiskDomain(domainIntent);
  const permitReason = [];

  if (strategy === 'recommendation') {
    return {
      retrieveNeeded: true,
      retrievalBlockedByStrategy: false,
      retrievalBlockReason: null,
      retrievalPermitReason: 'recommendation_strategy',
      retrievalReenabledBySlice: null
    };
  }

  if (blockedByDefault && preserveDirectAnswerFallback) {
    return {
      retrieveNeeded: false,
      retrievalBlockedByStrategy: true,
      retrievalBlockReason: `preserve_${fallbackType || strategy}`,
      retrievalPermitReason: null,
      retrievalReenabledBySlice: null
    };
  }

  if (blockedByDefault && requestShapeDirectAnswer) {
    return {
      retrieveNeeded: false,
      retrievalBlockedByStrategy: true,
      retrievalBlockReason: `request_shape_${requestShape}`,
      retrievalPermitReason: null,
      retrievalReenabledBySlice: null
    };
  }

  if (strategy === 'grounded_answer') permitReason.push('grounded_answer_strategy');
  if (domainIntent !== 'general') permitReason.push('domain_intent_activation');
  if (broadQuestion) permitReason.push('broad_question_activation');
  if (payload.followupResolvedFromHistory === true) permitReason.push('followup_history_activation');
  if (housingGrounding) permitReason.push('housing_grounding_probe');
  if (cityGrounding) permitReason.push('city_grounding_probe');
  if (explicitDomainGrounding) permitReason.push('explicit_domain_grounding_probe');
  if (broadGrounding) permitReason.push('broad_structured_grounding_probe');
  if (followupGrounding) permitReason.push('followup_context_grounding_probe');
  if (continuationContext && domainIntent !== 'general') {
    permitReason.push('domain_continuation_grounding_probe');
  }

  if (permitReason.length > 0 && messageText.length > 4) {
    const preferredSlice = genericFallbackSlice === 'other'
      ? (cityGrounding ? 'city' : (housingGrounding ? 'housing' : (followupGrounding ? 'followup' : 'broad')))
      : genericFallbackSlice;
    return {
      retrieveNeeded: true,
      retrievalBlockedByStrategy: false,
      retrievalBlockReason: null,
      retrievalPermitReason: permitReason.join('+'),
      retrievalReenabledBySlice: blockedByDefault ? preferredSlice : null
    };
  }

  if (!blockedByDefault) {
    if (messageText.length <= 10) {
      return {
        retrieveNeeded: false,
        retrievalBlockedByStrategy: false,
        retrievalBlockReason: 'message_too_short',
        retrievalPermitReason: null,
        retrievalReenabledBySlice: null
      };
    }
    return {
      retrieveNeeded: true,
      retrievalBlockedByStrategy: false,
      retrievalBlockReason: null,
      retrievalPermitReason: 'strategy_default',
      retrievalReenabledBySlice: null
    };
  }

  return {
    retrieveNeeded: false,
    retrievalBlockedByStrategy: true,
    retrievalBlockReason: `strategy_${strategy}`,
    retrievalPermitReason: null,
    retrievalReenabledBySlice: null
  };
}

function judgeNeedRetrieval(packet, strategyPlan) {
  return resolveRetrievalDecision(packet, strategyPlan).retrieveNeeded === true;
}

function judgeRetrievalQuality(result) {
  const payload = result && typeof result === 'object' ? result : {};
  if (payload.ok !== true) return 'bad';
  const quality = payload.assistantQuality && typeof payload.assistantQuality === 'object' ? payload.assistantQuality : {};
  const top1Score = Number.isFinite(Number(payload.top1Score)) ? Number(payload.top1Score) : Number(quality.kbTopScore || 0);
  const evidenceCoverage = Number.isFinite(Number(quality.evidenceCoverage)) ? Number(quality.evidenceCoverage) : 0;
  if (top1Score >= 0.8 && evidenceCoverage >= 0.8) return 'good';
  if (top1Score >= 0.45 && evidenceCoverage >= 0.5) return 'mixed';
  return 'bad';
}

function judgeEvidenceSufficiency(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const strategy = normalizeText(payload.strategy).toLowerCase();
  const retrievalNeeded = payload.retrieveNeeded === true;
  const retrievalQuality = normalizeText(payload.retrievalQuality).toLowerCase();
  const blockedReason = normalizeText(payload.blockedReason).toLowerCase();

  if (!retrievalNeeded) return 'answer';
  if (retrievalQuality === 'good') return 'answer';
  if (retrievalQuality === 'mixed') return strategy === 'recommendation' ? 'answer_with_hedge' : 'clarify';
  if (blockedReason === 'forbidden_domain') return 'refuse';
  return 'clarify';
}

module.exports = {
  resolveRetrievalDecision,
  judgeNeedRetrieval,
  judgeRetrievalQuality,
  judgeEvidenceSufficiency
};
