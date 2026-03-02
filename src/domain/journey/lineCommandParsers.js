'use strict';

const HOUSEHOLD_LABEL_MAP = Object.freeze({
  '単身': 'single',
  '1': 'single',
  'single': 'single',
  '夫婦': 'couple',
  '2': 'couple',
  'couple': 'couple',
  '帯同1': 'accompany1',
  '帯同１': 'accompany1',
  'accompany1': 'accompany1',
  '帯同2': 'accompany2',
  '帯同２': 'accompany2',
  'accompany2': 'accompany2'
});

const HOUSEHOLD_TO_SCENARIO = Object.freeze({
  single: 'A',
  couple: 'B',
  accompany1: 'C',
  accompany2: 'D'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDateText(value) {
  const text = normalizeText(value).replace(/\//g, '-');
  if (!text) return null;
  const matched = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return iso;
}

function normalizeHouseholdLabel(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const lowered = text.toLowerCase();
  return HOUSEHOLD_LABEL_MAP[text] || HOUSEHOLD_LABEL_MAP[lowered] || null;
}

function parseJourneyLineCommand(text) {
  const raw = normalizeText(text);
  if (!raw) return null;

  if (/^TODO一覧$/i.test(raw)) {
    return { action: 'todo_list' };
  }

  const complete = raw.match(/^TODO完了\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (complete) {
    return {
      action: 'todo_complete',
      todoKey: normalizeText(complete[1])
    };
  }

  const inProgress = raw.match(/^TODO(?:進行中|開始)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (inProgress) {
    return {
      action: 'todo_in_progress',
      todoKey: normalizeText(inProgress[1])
    };
  }

  const notStarted = raw.match(/^TODO(?:未着手|戻す)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (notStarted) {
    return {
      action: 'todo_not_started',
      todoKey: normalizeText(notStarted[1])
    };
  }

  const snooze = raw.match(/^TODO(?:スヌーズ|後で)\s*[:：]?\s*([A-Za-z0-9_\-]+)(?:\s*[:：]\s*(.+))?$/i);
  if (snooze) {
    const todoKey = normalizeText(snooze[1]);
    const value = normalizeText(snooze[2] || '');
    const date = normalizeDateText(value);
    const days = Number(value);
    return {
      action: 'todo_snooze',
      todoKey,
      snoozeUntil: date || null,
      snoozeDays: Number.isInteger(days) && days >= 1 && days <= 30 ? days : null
    };
  }

  const household = raw.match(/^属性\s*[:：]?\s*(.+)$/i);
  if (household) {
    const householdType = normalizeHouseholdLabel(household[1]);
    if (!householdType) return { action: 'invalid_household' };
    return {
      action: 'set_household',
      householdType,
      scenarioKeyMirror: HOUSEHOLD_TO_SCENARIO[householdType] || null
    };
  }

  const departure = raw.match(/^渡航日\s*[:：]?\s*(.+)$/i);
  if (departure) {
    const date = normalizeDateText(departure[1]);
    if (!date) return { action: 'invalid_departure_date' };
    return {
      action: 'set_departure_date',
      departureDate: date
    };
  }

  const assignment = raw.match(/^着任日\s*[:：]?\s*(.+)$/i);
  if (assignment) {
    const date = normalizeDateText(assignment[1]);
    if (!date) return { action: 'invalid_assignment_date' };
    return {
      action: 'set_assignment_date',
      assignmentDate: date
    };
  }

  return null;
}

function parseJourneyPostbackData(data) {
  const raw = normalizeText(data);
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const action = normalizeText(params.get('action'));
  if (!action) return null;

  if (action === 'set_household') {
    const householdType = normalizeHouseholdLabel(params.get('value'));
    if (!householdType) return { action: 'invalid_household' };
    return {
      action,
      householdType,
      scenarioKeyMirror: HOUSEHOLD_TO_SCENARIO[householdType] || null
    };
  }

  if (action === 'set_departure_date') {
    const departureDate = normalizeDateText(params.get('value'));
    if (!departureDate) return { action: 'invalid_departure_date' };
    return { action, departureDate };
  }

  if (action === 'set_assignment_date') {
    const assignmentDate = normalizeDateText(params.get('value'));
    if (!assignmentDate) return { action: 'invalid_assignment_date' };
    return { action, assignmentDate };
  }

  if (action === 'todo_complete') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_complete_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_in_progress') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_in_progress_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_not_started') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_not_started_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_snooze') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_snooze_missing' };
    const until = normalizeDateText(params.get('until'));
    const daysRaw = normalizeText(params.get('days'));
    const days = Number(daysRaw);
    return {
      action,
      todoKey,
      snoozeUntil: until,
      snoozeDays: Number.isInteger(days) && days >= 1 && days <= 30 ? days : null
    };
  }

  if (action === 'todo_list') {
    return { action };
  }

  return null;
}

module.exports = {
  HOUSEHOLD_LABEL_MAP,
  HOUSEHOLD_TO_SCENARIO,
  normalizeDateText,
  parseJourneyLineCommand,
  parseJourneyPostbackData
};
