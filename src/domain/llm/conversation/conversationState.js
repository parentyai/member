'use strict';

const CONVERSATION_STATES = Object.freeze({
  ENTRY: 'ENTRY',
  CLARIFY: 'CLARIFY',
  PLAN: 'PLAN',
  EXECUTE: 'EXECUTE',
  BLOCKED: 'BLOCKED',
  CLOSE: 'CLOSE'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [CONVERSATION_STATES.ENTRY]: [CONVERSATION_STATES.CLARIFY, CONVERSATION_STATES.PLAN],
  [CONVERSATION_STATES.PLAN]: [CONVERSATION_STATES.EXECUTE],
  [CONVERSATION_STATES.EXECUTE]: [CONVERSATION_STATES.CLOSE],
  [CONVERSATION_STATES.BLOCKED]: [CONVERSATION_STATES.PLAN],
  [CONVERSATION_STATES.CLARIFY]: [CONVERSATION_STATES.PLAN],
  [CONVERSATION_STATES.CLOSE]: []
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function chooseTargetState(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const blockedReasons = Array.isArray(payload.blockedReasons) ? payload.blockedReasons.filter(Boolean) : [];
  const analysis = payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : {};
  const question = normalizeText(payload.question);

  if (blockedReasons.length) return CONVERSATION_STATES.BLOCKED;
  if (includesAny(question, [/(ありがとう|助かった|解決|ok|了解)/i])) return CONVERSATION_STATES.CLOSE;
  if (includesAny(question, [/(実行した|送信した|完了した|done|終わった)/i])) return CONVERSATION_STATES.EXECUTE;

  const missing = Array.isArray(analysis.missing) ? analysis.missing.filter(Boolean) : [];
  const actions = Array.isArray(analysis.nextActions) ? analysis.nextActions.filter(Boolean) : [];

  if (missing.length && actions.length <= 1) return CONVERSATION_STATES.CLARIFY;
  if (actions.length) return CONVERSATION_STATES.PLAN;
  return CONVERSATION_STATES.CLARIFY;
}

function transitionState(fromState, toState) {
  const from = Object.values(CONVERSATION_STATES).includes(fromState)
    ? fromState
    : CONVERSATION_STATES.ENTRY;
  const to = Object.values(CONVERSATION_STATES).includes(toState)
    ? toState
    : CONVERSATION_STATES.CLARIFY;

  if (to === CONVERSATION_STATES.BLOCKED) {
    return { from, to: CONVERSATION_STATES.BLOCKED, validTransition: true, reason: 'any_to_blocked' };
  }

  const allowed = Array.isArray(ALLOWED_TRANSITIONS[from]) ? ALLOWED_TRANSITIONS[from] : [];
  if (allowed.includes(to)) {
    return { from, to, validTransition: true, reason: 'allowed_transition' };
  }

  if (from === CONVERSATION_STATES.BLOCKED && to === CONVERSATION_STATES.PLAN) {
    return { from, to, validTransition: true, reason: 'blocked_to_plan' };
  }

  return {
    from,
    to: from,
    validTransition: false,
    reason: 'transition_blocked'
  };
}

function resolveConversationState(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const from = CONVERSATION_STATES.ENTRY;
  const desired = chooseTargetState(payload);
  const transitioned = transitionState(from, desired);
  return {
    from: transitioned.from,
    to: transitioned.to,
    validTransition: transitioned.validTransition,
    reason: transitioned.reason
  };
}

module.exports = {
  CONVERSATION_STATES,
  ALLOWED_TRANSITIONS,
  chooseTargetState,
  transitionState,
  resolveConversationState
};
