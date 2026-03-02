'use strict';

const TASK_STATUS = Object.freeze({
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
  BLOCKED: 'blocked',
  SNOOZED: 'snoozed'
});

const TASK_STATUS_VALUES = Object.freeze(Object.values(TASK_STATUS));

const LEAD_TIME_KIND = Object.freeze({
  AFTER: 'after',
  BEFORE_DEADLINE: 'before_deadline'
});

const LEAD_TIME_KIND_VALUES = Object.freeze(Object.values(LEAD_TIME_KIND));

const BLOCKED_REASON = Object.freeze({
  DEPENDENCY_UNMET: 'dependency_unmet',
  QUIET_HOURS: 'quiet_hours',
  KILL_SWITCH: 'kill_switch',
  PLAN_LIMIT: 'plan_limit',
  MAX_ACTIONS: 'max_actions',
  INVALID_TRIGGER: 'invalid_trigger'
});

const RISK_WEIGHT = Object.freeze({
  low: 1,
  medium: 2,
  high: 3
});

module.exports = {
  TASK_STATUS,
  TASK_STATUS_VALUES,
  LEAD_TIME_KIND,
  LEAD_TIME_KIND_VALUES,
  BLOCKED_REASON,
  RISK_WEIGHT
};
