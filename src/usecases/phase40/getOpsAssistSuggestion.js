'use strict';

const { getOpsAssistContext } = require('../phase38/getOpsAssistContext');
const { buildOpsAssistPrompt } = require('../phase45/buildOpsAssistPrompt');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');

function resolveAllowedNextActions(context, promptPayload) {
  if (promptPayload && promptPayload.constraints) {
    const allowed = promptPayload.constraints.allowedNextActions;
    if (Array.isArray(allowed)) return allowed;
  }
  if (context && context.constraints && Array.isArray(context.constraints.allowedNextActions)) {
    return context.constraints.allowedNextActions;
  }
  return [];
}

function resolveReadinessStatus(context, promptPayload) {
  if (promptPayload && promptPayload.constraints && typeof promptPayload.constraints.readiness === 'string') {
    return promptPayload.constraints.readiness;
  }
  if (context && context.constraints && typeof context.constraints.readiness === 'string') {
    return context.constraints.readiness;
  }
  return null;
}

function resolveDefaultNextAction(allowedNextActions, readinessStatus) {
  const allowed = Array.isArray(allowedNextActions) ? allowedNextActions : [];
  if (readinessStatus !== 'READY') {
    if (allowed.includes('STOP_AND_ESCALATE')) return 'STOP_AND_ESCALATE';
    return allowed[0] || 'NO_ACTION';
  }
  if (allowed.includes('NO_ACTION')) return 'NO_ACTION';
  return allowed[0] || 'NO_ACTION';
}

function buildSuggestion(context, promptPayload) {
  const readiness = resolveReadinessStatus(context, promptPayload);
  const timeline = Array.isArray(context && context.decisionTimeline) ? context.decisionTimeline : [];
  const basedOn = [];
  if (context && context.opsState) basedOn.push('opsState');
  if (timeline.length) basedOn.push('decisionTimeline');
  basedOn.push('constraints');

  const riskFlags = [];
  if (readiness !== 'READY') riskFlags.push('readiness_not_ready');
  if (!timeline.length) riskFlags.push('no_timeline');

  const allowedNextActions = resolveAllowedNextActions(context, promptPayload);
  const nextAction = resolveDefaultNextAction(allowedNextActions, readiness);
  const reason = readiness !== 'READY'
    ? 'readiness not ready; defaulting to STOP_AND_ESCALATE'
    : 'default safe action within allowedNextActions';
  const suggestionText = `${nextAction}: ${reason}`;
  const confidence = readiness === 'READY' ? 'MEDIUM' : 'LOW';

  return {
    suggestionText,
    confidence,
    basedOn,
    riskFlags,
    disclaimer: 'This is advisory only',
    suggestion: {
      nextAction,
      reason
    },
    model: 'ops-assist-rules'
  };
}

async function getOpsAssistSuggestion(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');

  const contextFn = deps && deps.getOpsAssistContext ? deps.getOpsAssistContext : getOpsAssistContext;
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);

  const context = payload.context
    ? payload.context
    : await contextFn({ lineUserId, notificationId: payload.notificationId }, deps);

  const opsConsoleView = payload.opsConsoleView
    ? payload.opsConsoleView
    : (context && context.opsConsoleSnapshot ? context.opsConsoleSnapshot : {});
  const promptPayload = buildOpsAssistPrompt({ opsConsoleView });

  const suggestion = buildSuggestion(context, promptPayload);

  if (timelineRepo && typeof timelineRepo.appendTimelineEntry === 'function') {
    await timelineRepo.appendTimelineEntry({
      lineUserId,
      source: 'llm_assist',
      action: 'SUGGEST',
      refId: null,
      notificationId: payload.notificationId || null,
      snapshot: Object.assign({}, suggestion, { promptPayload })
    });
  }

  return Object.assign({}, suggestion, { promptPayload });
}

module.exports = {
  getOpsAssistSuggestion
};
