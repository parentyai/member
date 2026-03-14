'use strict';

const { resolveJourneyGroundingContext } = require('./resolveJourneyGroundingContext');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeNextActions(values) {
  const rows = Array.isArray(values) ? values : [];
  return rows
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 5);
}

function buildTaskGraphState(payload, base) {
  if (payload.taskGraphState && typeof payload.taskGraphState === 'object') {
    return Object.assign({}, payload.taskGraphState);
  }
  const snapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : {};
  const tasks = Array.isArray(snapshot.topTasks)
    ? snapshot.topTasks
    : (Array.isArray(snapshot.topOpenTasks)
      ? snapshot.topOpenTasks
      : (Array.isArray(snapshot.openTasksTop5) ? snapshot.openTasksTop5 : []));
  const blockedTask = base.blockedTask && typeof base.blockedTask === 'object' ? base.blockedTask : null;
  return {
    journeyPhase: base.phase,
    taskCount: tasks.length,
    blockedTaskKey: blockedTask ? normalizeText(blockedTask.key || blockedTask.todoKey || blockedTask.taskKey || blockedTask.id) || null : null,
    blockedTaskStatus: blockedTask ? normalizeText(blockedTask.status || blockedTask.graphStatus || blockedTask.progressState).toLowerCase() || null : null
  };
}

function resolveJourneyQualityContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const base = resolveJourneyGroundingContext(payload);
  const nextActions = normalizeNextActions(
    Array.isArray(payload.nextActions) && payload.nextActions.length
      ? payload.nextActions
      : base.nextActions
  );
  const nextActionCandidates = normalizeNextActions(
    Array.isArray(payload.nextActionCandidates) && payload.nextActionCandidates.length
      ? payload.nextActionCandidates
      : nextActions
  );
  const taskGraphState = buildTaskGraphState(payload, base);
  return {
    active: base.active,
    phase: base.phase,
    taskBlockerDetected: base.taskBlockerDetected,
    journeyAlignedAction: base.journeyAlignedAction,
    blockedTask: base.blockedTask,
    taskGraphState,
    nextActionCandidates,
    nextActions,
    reasonCodes: Array.isArray(base.reasonCodes) ? base.reasonCodes.slice(0, 12) : []
  };
}

module.exports = {
  resolveJourneyQualityContext
};
