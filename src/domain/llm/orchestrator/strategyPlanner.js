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
  const followupIntent = normalizeText(payload.followupIntent || '').toLowerCase();
  const followupIntentReason = normalizeText(payload.followupIntentReason || '').toLowerCase();
  const followupCarryFromHistory = payload.followupCarryFromHistory === true || followupIntentReason === 'history_followup_carry';
  const hasFollowupIntent = followupIntent === 'docs_required' || followupIntent === 'appointment_needed' || followupIntent === 'next_step';
  const directAnswerHint = hasFollowupIntent || payload.contextResume === true || payload.lowInformationMessage === true || followupCarryFromHistory;
  const recoverySignal = payload.recoverySignal === true;
  const intentReason = payload.intentDecision && typeof payload.intentDecision === 'object'
    ? normalizeText(payload.intentDecision.reason).toLowerCase()
    : '';
  const llmConciergeEnabled = payload.llmFlags && payload.llmFlags.llmConciergeEnabled === true;
  const opportunityDecision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;
  const messageText = normalizeText(payload.messageText);

  if (routerMode === 'greeting' || routerMode === 'casual') {
    if (recoverySignal && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      };
    }
    if (hasFollowupIntent && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      };
    }
    if (followupCarryFromHistory && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'history_followup_carry',
        directAnswerFirst: true,
        clarifySuppressed: true
      };
    }
    if (payload.contextResume === true && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'contextual_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: true
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
        fallbackType: 'low_information_clarify',
        directAnswerFirst: false,
        clarifySuppressed: false
      };
    }
    return {
      strategy: 'casual',
      conversationMode: 'casual',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['conversation_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    };
  }

  if (normalizedIntent !== 'general') {
    if (recoverySignal) {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      };
    }
    return {
      strategy: 'domain_concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: directAnswerHint,
      clarifySuppressed: directAnswerHint
    };
  }

  if (routerMode === 'problem') {
    return {
      strategy: 'concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    };
  }

  if (routerMode === 'activity') {
    return {
      strategy: 'recommendation',
      conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
      retrieveNeeded: true,
      verifyNeeded: true,
      candidateSet: ['grounded_candidate', 'conversation_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    };
  }

  if (routerMode === 'question') {
    if (recoverySignal && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      };
    }
    if (hasFollowupIntent && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      };
    }
    if (followupCarryFromHistory && normalizedIntent !== 'general') {
      return {
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'history_followup_carry',
        directAnswerFirst: true,
        clarifySuppressed: true
      };
    }
    const clarifyFirst = isBroadQuestion(messageText)
      && (!opportunityDecision || opportunityDecision.conversationMode !== 'concierge')
      && directAnswerHint !== true;
    return {
      strategy: clarifyFirst ? 'clarify' : 'grounded_answer',
      conversationMode: clarifyFirst ? 'casual' : (llmConciergeEnabled ? 'concierge' : 'casual'),
      retrieveNeeded: clarifyFirst ? false : true,
      verifyNeeded: clarifyFirst ? false : true,
      candidateSet: clarifyFirst
        ? ['clarify_candidate', 'conversation_candidate']
        : ['grounded_candidate', 'composed_concierge_candidate', 'clarify_candidate'],
      fallbackType: clarifyFirst ? 'low_specificity_clarify' : null,
      directAnswerFirst: !clarifyFirst,
      clarifySuppressed: false
    };
  }

  if (recoverySignal) {
    return {
      strategy: 'clarify',
      conversationMode: 'casual',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['clarify_candidate', 'conversation_candidate'],
      fallbackType: 'recovery_clarify',
      directAnswerFirst: false,
      clarifySuppressed: false
    };
  }

  return {
    strategy: 'grounded_answer',
    conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
    retrieveNeeded: true,
    verifyNeeded: true,
    candidateSet: ['grounded_candidate', 'clarify_candidate'],
    fallbackType: null,
    directAnswerFirst: false,
    clarifySuppressed: false
  };
}

module.exports = {
  buildStrategyPlan,
  isBroadQuestion
};
