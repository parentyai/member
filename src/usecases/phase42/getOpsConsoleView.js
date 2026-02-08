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

  const consoleResult = await consoleFn({ lineUserId }, deps);
  const context = await contextFn({ lineUserId, notificationId }, deps);
  const llmSuggestion = await suggestionFn({ lineUserId, notificationId, context }, deps);

  return {
    user: {
      lineUserId
    },
    opsState: consoleResult ? consoleResult.opsState : null,
    decisionTimeline: Array.isArray(context && context.decisionTimeline) ? context.decisionTimeline : [],
    llmSuggestion,
    allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
      ? consoleResult.allowedNextActions
      : [],
    readiness: consoleResult ? consoleResult.readiness : null
  };
}

module.exports = {
  getOpsConsoleView
};
