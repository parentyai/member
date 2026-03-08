'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isBroadQuestion(text) {
  const normalized = normalizeText(text).replace(/[?？!！。]+$/g, '');
  if (!normalized) return true;
  if (normalized.length <= 8) return true;
  return /(どうすれば|どうしたら|何から|何をすれば|相談したい|困ってる|進めたい)/.test(normalized);
}

function buildStrategyPlan(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const routerMode = normalizeText(payload.routerMode || 'casual').toLowerCase();
  const normalizedIntent = normalizeText(payload.normalizedConversationIntent || 'general').toLowerCase();
  const intentReason = payload.intentDecision && typeof payload.intentDecision === 'object'
    ? normalizeText(payload.intentDecision.reason).toLowerCase()
    : '';
  const llmConciergeEnabled = payload.llmFlags && payload.llmFlags.llmConciergeEnabled === true;
  const opportunityDecision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;
  const messageText = normalizeText(payload.messageText);

  if (routerMode === 'greeting' || routerMode === 'casual') {
    if (payload.contextResume === true && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'contextual_domain_resume'
      };
    }
    const isGreetingOrSmalltalk = intentReason === 'greeting_detected' || intentReason === 'smalltalk_detected';
    if (payload.lowInformationMessage === true && !isGreetingOrSmalltalk) {
      return {
        strategy: 'clarify',
        conversationMode: 'casual',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['clarify_candidate', 'conversation_candidate'],
        fallbackType: 'low_information_clarify'
      };
    }
    return {
      strategy: 'casual',
      conversationMode: 'casual',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['conversation_candidate'],
      fallbackType: null
    };
  }

  if (normalizedIntent !== 'general') {
    return {
      strategy: 'domain_concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null
    };
  }

  if (routerMode === 'problem') {
    return {
      strategy: 'concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null
    };
  }

  if (routerMode === 'activity') {
    return {
      strategy: 'recommendation',
      conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
      retrieveNeeded: true,
      verifyNeeded: true,
      candidateSet: ['grounded_candidate', 'conversation_candidate', 'clarify_candidate'],
      fallbackType: null
    };
  }

  if (routerMode === 'question') {
    const clarifyFirst = isBroadQuestion(messageText)
      && (!opportunityDecision || opportunityDecision.conversationMode !== 'concierge');
    return {
      strategy: clarifyFirst ? 'clarify' : 'grounded_answer',
      conversationMode: clarifyFirst ? 'casual' : (llmConciergeEnabled ? 'concierge' : 'casual'),
      retrieveNeeded: clarifyFirst ? false : true,
      verifyNeeded: clarifyFirst ? false : true,
      candidateSet: clarifyFirst
        ? ['clarify_candidate', 'conversation_candidate']
        : ['grounded_candidate', 'composed_concierge_candidate', 'clarify_candidate'],
      fallbackType: clarifyFirst ? 'low_specificity_clarify' : null
    };
  }

  return {
    strategy: 'grounded_answer',
    conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
    retrieveNeeded: true,
    verifyNeeded: true,
    candidateSet: ['grounded_candidate', 'clarify_candidate'],
    fallbackType: null
  };
}

module.exports = {
  buildStrategyPlan,
  isBroadQuestion
};
