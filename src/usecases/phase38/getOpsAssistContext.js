'use strict';

const { getUserStateSummary } = require('../phase5/getUserStateSummary');
const { getMemberSummary } = require('../phase6/getMemberSummary');
const { getOpsConsole } = require('../phase25/getOpsConsole');
const { getNotificationDecisionTrace } = require('../phase37/getNotificationDecisionTrace');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');

async function getOpsAssistContext(params, deps) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');

  const userSummaryFn = deps && deps.getUserStateSummary ? deps.getUserStateSummary : getUserStateSummary;
  const memberSummaryFn = deps && deps.getMemberSummary ? deps.getMemberSummary : getMemberSummary;
  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);
  const traceFn = deps && deps.getNotificationDecisionTrace
    ? deps.getNotificationDecisionTrace
    : getNotificationDecisionTrace;

  const lineUserId = payload.lineUserId;
  const timelineLimit = typeof payload.timelineLimit === 'number' ? payload.timelineLimit : 10;
  const notificationId = payload.notificationId || null;

  const [userStateSummary, memberSummary, consoleResult, decisionTimeline] = await Promise.all([
    userSummaryFn({ lineUserId }, deps),
    memberSummaryFn({ lineUserId }, deps),
    consoleFn({ lineUserId }, deps),
    timelineRepo
      ? timelineRepo.listTimelineEntries(lineUserId, timelineLimit)
      : Promise.resolve([])
  ]);

  const notificationSummary = {
    decisionTrace: await traceFn(notificationId, deps)
  };

  const readiness = consoleResult && consoleResult.readiness && consoleResult.readiness.status
    ? consoleResult.readiness.status
    : 'NOT_READY';

  return {
    opsConsoleSnapshot: {
      readiness: consoleResult ? consoleResult.readiness : null,
      opsState: consoleResult ? consoleResult.opsState : null,
      latestDecisionLog: consoleResult ? consoleResult.latestDecisionLog : null,
      userStateSummary,
      memberSummary,
      allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
        ? consoleResult.allowedNextActions
        : []
    },
    userStateSummary,
    memberSummary,
    notificationSummary,
    opsState: consoleResult ? consoleResult.opsState : null,
    executionStatus: consoleResult ? consoleResult.executionStatus : null,
    decisionTimeline,
    constraints: {
      allowedNextActions: consoleResult && Array.isArray(consoleResult.allowedNextActions)
        ? consoleResult.allowedNextActions
        : [],
      readiness
    }
  };
}

module.exports = {
  getOpsAssistContext
};
