'use strict';

const { getOpsAssistContext } = require('../phase38/getOpsAssistContext');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');

function buildSuggestion(context) {
  const readiness = context && context.constraints ? context.constraints.readiness : null;
  const timeline = Array.isArray(context && context.decisionTimeline) ? context.decisionTimeline : [];
  const basedOn = [];
  if (context && context.opsState) basedOn.push('opsState');
  if (timeline.length) basedOn.push('decisionTimeline');
  basedOn.push('constraints');

  const riskFlags = [];
  if (readiness !== 'READY') riskFlags.push('readiness_not_ready');
  if (!timeline.length) riskFlags.push('no_timeline');

  const suggestionText = '';
  const confidence = readiness === 'READY' ? 'MEDIUM' : 'LOW';

  return {
    suggestionText,
    confidence,
    basedOn,
    riskFlags,
    disclaimer: 'This is advisory only'
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

  const suggestion = buildSuggestion(context);

  if (timelineRepo && typeof timelineRepo.appendTimelineEntry === 'function') {
    await timelineRepo.appendTimelineEntry({
      lineUserId,
      source: 'llm_assist',
      action: 'SUGGEST',
      refId: null,
      notificationId: payload.notificationId || null,
      snapshot: suggestion
    });
  }

  return suggestion;
}

module.exports = {
  getOpsAssistSuggestion
};
