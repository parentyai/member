'use strict';

const { parseJourneyPostbackData } = require('../../domain/journey/lineCommandParsers');
const { handleJourneyLineCommand } = require('./handleJourneyLineCommand');

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

async function handleJourneyPostback(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const data = normalizeText(payload.data);
  if (!lineUserId || !data) return { handled: false };

  const action = parseJourneyPostbackData(data);
  if (!action) return { handled: false };

  const text = toCommandText(action);
  if (!text) return { handled: false };
  return handleJourneyLineCommand({ lineUserId, text }, deps);
}

module.exports = {
  handleJourneyPostback
};
