'use strict';

const { parseJourneyPostbackData } = require('../../domain/journey/lineCommandParsers');
const { handleJourneyLineCommand } = require('./handleJourneyLineCommand');
const { buildTaskDetailSectionReply } = require('./taskDetailSectionReply');
const { isTaskDetailLineEnabled } = require('../../domain/tasks/featureFlags');

const HOUSEHOLD_TEXT = Object.freeze({
  single: '単身',
  couple: '夫婦',
  accompany1: '帯同1',
  accompany2: '帯同2'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toCommandText(action) {
  if (!action || typeof action !== 'object') return '';
  if (action.action === 'set_household') {
    return `属性:${HOUSEHOLD_TEXT[action.householdType] || action.householdType || ''}`;
  }
  if (action.action === 'set_departure_date') {
    return `渡航日:${action.departureDate || ''}`;
  }
  if (action.action === 'set_assignment_date') {
    return `着任日:${action.assignmentDate || ''}`;
  }
  if (action.action === 'todo_complete') {
    return `TODO完了:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_in_progress') {
    return `TODO進行中:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_not_started') {
    return `TODO未着手:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_snooze') {
    if (action.snoozeUntil) return `TODOスヌーズ:${action.todoKey || ''}:${action.snoozeUntil}`;
    if (action.snoozeDays) return `TODOスヌーズ:${action.todoKey || ''}:${action.snoozeDays}`;
    return `TODOスヌーズ:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_detail') {
    return `TODO詳細:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_list') {
    return 'TODO一覧';
  }
  if (action.action === 'invalid_household') {
    return '属性:invalid';
  }
  if (action.action === 'invalid_departure_date') {
    return '渡航日:invalid';
  }
  if (action.action === 'invalid_assignment_date') {
    return '着任日:invalid';
  }
  return '';
}

async function handleTodoDetailSectionAction(lineUserId, action, deps) {
  if (!isTaskDetailLineEnabled()) {
    return {
      handled: true,
      replyText: 'タスク詳細表示は現在停止中です。'
    };
  }
  const todoKey = normalizeText(action && action.todoKey);
  const section = normalizeText(action && action.section).toLowerCase();
  const startChunk = Number(action && action.startChunk);
  return buildTaskDetailSectionReply({
    lineUserId,
    todoKey,
    section,
    startChunk: Number.isFinite(startChunk) ? startChunk : 1
  }, deps);
}

async function handleJourneyPostback(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const data = normalizeText(payload.data);
  if (!lineUserId || !data) return { handled: false };

  const action = parseJourneyPostbackData(data);
  if (!action) return { handled: false };

  if (action.action === 'todo_detail_section') {
    return handleTodoDetailSectionAction(lineUserId, action, deps);
  }

  const text = toCommandText(action);
  if (!text) return { handled: false };
  return handleJourneyLineCommand({ lineUserId, text }, deps);
}

module.exports = {
  handleJourneyPostback,
  handleTodoDetailSectionAction
};
