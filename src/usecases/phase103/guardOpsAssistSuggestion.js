'use strict';

function guardOpsAssistSuggestion(params) {
  const payload = params || {};
  const input = payload.opsAssistInput || {};
  const readiness = input.readiness || {};
  const readinessStatus = typeof readiness.status === 'string' ? readiness.status : null;
  const opsState = input.opsState || null;
  const allowedNextActions = input.constraints && Array.isArray(input.constraints.allowedNextActions)
    ? input.constraints.allowedNextActions
    : [];
  const reasons = [];

  let forcedAction = null;
  if (readinessStatus === 'NOT_READY') {
    forcedAction = 'STOP_AND_ESCALATE';
    reasons.push('readiness_not_ready');
  }

  if (!opsState || !opsState.nextAction) {
    forcedAction = forcedAction || 'STOP_AND_ESCALATE';
    reasons.push('ops_state_missing');
  }

  if (opsState && opsState.nextAction && allowedNextActions.length) {
    if (!allowedNextActions.includes(opsState.nextAction)) {
      forcedAction = forcedAction || 'STOP_AND_ESCALATE';
      reasons.push('ops_state_outside_allowed');
    }
  }

  const candidateAction = typeof payload.suggestedAction === 'string' ? payload.suggestedAction : null;
  const finalAction = forcedAction || candidateAction;
  let status = 'OK';
  const addReasonOnce = (reason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const skipCandidateBlock = readinessStatus === 'NOT_READY';
  if (!skipCandidateBlock && candidateAction && allowedNextActions.length && !allowedNextActions.includes(candidateAction)) {
    addReasonOnce('action_not_allowed');
    status = 'BLOCK';
  }
  if (finalAction && allowedNextActions.length && !allowedNextActions.includes(finalAction)) {
    addReasonOnce('action_not_allowed');
    status = 'BLOCK';
  }

  return {
    status,
    reasons,
    forcedAction,
    allowedNextActions,
    readinessStatus
  };
}

module.exports = {
  guardOpsAssistSuggestion
};
