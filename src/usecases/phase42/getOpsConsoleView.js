'use strict';

const { getOpsConsole } = require('../phase25/getOpsConsole');
const { getOpsAssistContext } = require('../phase38/getOpsAssistContext');
const { getOpsAssistSuggestion } = require('../phase40/getOpsAssistSuggestion');

async function getOpsConsoleView(params, deps) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const contextFn = deps && deps.getOpsAssistContext ? deps.getOpsAssistContext : getOpsAssistContext;
  const suggestionFn = deps && deps.getOpsAssistSuggestion ? deps.getOpsAssistSuggestion : getOpsAssistSuggestion;

  const lineUserId = payload.lineUserId;
  const notificationId = payload.notificationId || null;
  const includeAssist = payload.includeAssist === true;

  const consoleResult = await consoleFn({ lineUserId }, deps);
  const context = payload.context
    ? payload.context
    : await contextFn({ lineUserId, notificationId }, deps);
  const llmSuggestion = includeAssist
    ? await suggestionFn({ lineUserId, notificationId, context }, deps)
    : null;
  const suggestionSchema = llmSuggestion && llmSuggestion.suggestionSchema
    ? llmSuggestion.suggestionSchema
    : (llmSuggestion && llmSuggestion.suggestion ? llmSuggestion.suggestion : null);
  const lastSuggestionAuditId = llmSuggestion && llmSuggestion.suggestionAuditId
    ? llmSuggestion.suggestionAuditId
    : null;

  return {
    ok: true,
    user: {
      lineUserId
    },
    opsState: consoleResult ? consoleResult.opsState : null,
    decisionTimeline: Array.isArray(context && context.decisionTimeline) ? context.decisionTimeline : [],
    llmSuggestion,
    suggestion: suggestionSchema,
    lastSuggestionAuditId,
    allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
      ? consoleResult.allowedNextActions
      : [],
    readiness: consoleResult ? consoleResult.readiness : null,
    recommendedNextAction: consoleResult ? consoleResult.recommendedNextAction : null,
    latestDecisionLog: consoleResult ? consoleResult.latestDecisionLog : null,
    userStateSummary: consoleResult ? consoleResult.userStateSummary : null,
    memberSummary: consoleResult ? consoleResult.memberSummary : null,
    suggestedTemplateKey: consoleResult ? consoleResult.suggestedTemplateKey : null
  };
}

module.exports = {
  getOpsConsoleView
};
