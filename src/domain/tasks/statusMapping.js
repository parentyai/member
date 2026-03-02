'use strict';

const { TASK_STATUS, TASK_STATUS_VALUES } = require('./constants');

function normalizeTaskStatus(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback || TASK_STATUS.TODO;
  if (!TASK_STATUS_VALUES.includes(normalized)) return fallback || TASK_STATUS.TODO;
  return normalized;
}

function toTaskStatusFromJourneyTodo(todo) {
  const row = todo && typeof todo === 'object' ? todo : {};
  const status = String(row.status || '').trim().toLowerCase();
  const journeyState = String(row.journeyState || '').trim().toLowerCase();
  const progressState = String(row.progressState || '').trim().toLowerCase();
  if (status === 'completed' || status === 'skipped' || journeyState === 'done') return TASK_STATUS.DONE;
  if (journeyState === 'blocked' || row.graphStatus === 'locked') return TASK_STATUS.BLOCKED;
  if (journeyState === 'snoozed') return TASK_STATUS.SNOOZED;
  if (progressState === 'in_progress' || journeyState === 'in_progress') return TASK_STATUS.DOING;
  return TASK_STATUS.TODO;
}

function toJourneyPatchFromTaskStatus(status, blockedReason) {
  const normalized = normalizeTaskStatus(status, TASK_STATUS.TODO);
  if (normalized === TASK_STATUS.DONE) {
    return {
      status: 'completed',
      progressState: 'in_progress',
      graphStatus: 'done',
      journeyState: 'done',
      lockReasons: []
    };
  }
  if (normalized === TASK_STATUS.BLOCKED) {
    return {
      status: 'open',
      progressState: 'not_started',
      graphStatus: 'locked',
      journeyState: 'blocked',
      lockReasons: blockedReason ? [blockedReason] : ['dependency_unmet']
    };
  }
  if (normalized === TASK_STATUS.SNOOZED) {
    return {
      status: 'open',
      progressState: 'not_started',
      graphStatus: 'actionable',
      journeyState: 'snoozed'
    };
  }
  if (normalized === TASK_STATUS.DOING) {
    return {
      status: 'open',
      progressState: 'in_progress',
      graphStatus: 'actionable',
      journeyState: 'in_progress'
    };
  }
  return {
    status: 'open',
    progressState: 'not_started',
    graphStatus: 'actionable',
    journeyState: 'planned'
  };
}

module.exports = {
  normalizeTaskStatus,
  toTaskStatusFromJourneyTodo,
  toJourneyPatchFromTaskStatus
};
